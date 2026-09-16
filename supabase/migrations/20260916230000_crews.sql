-- =============================================================================
-- Phase 3a: crews
--
--   crews         a named group of drivers, owned by whoever created it
--   crew_members  who is in which crew
--
-- Joining happens with a 6-character invite code, through a database function
-- rather than by letting the app write membership rows directly.
--
-- A note on the helper functions below. A rule like "you may read crew_members
-- rows if you are a member of that crew" has to look at crew_members to decide
-- whether you may look at crew_members, which Postgres refuses as infinite
-- recursion. The usual fix, used here, is small SECURITY DEFINER functions:
-- they answer that one question with the table's own rules switched off, so
-- there's no loop. Each is locked down so only signed-in users can call it.
-- =============================================================================


-- 1. Invite codes -------------------------------------------------------------
-- Six characters, no I/O/0/1 so codes read over the phone aren't ambiguous.
create function public.generate_invite_code()
returns text
language plpgsql
-- SECURITY DEFINER for two reasons: this runs as the column default when a user
-- creates a crew, so the caller must be allowed to run it; and checking that a
-- code is unused has to see every crew, not just the caller's own.
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.crews where invite_code = code);
  end loop;
  return code;
end;
$$;

revoke execute on function public.generate_invite_code() from public, anon;
grant execute on function public.generate_invite_code() to authenticated;


-- 2. Tables -------------------------------------------------------------------
create table public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 40),
  city_id text not null references public.cities (id),
  owner_id uuid not null references auth.users (id) on delete cascade,
  invite_code text not null unique default public.generate_invite_code()
    check (invite_code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.crews is 'Groups of drivers. Convoys (Phase 3b) will belong to a crew.';

create index crews_city_id_idx on public.crews (city_id);

create table public.crew_members (
  crew_id uuid not null references public.crews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);

create index crew_members_user_id_idx on public.crew_members (user_id);


-- 3. Helper functions ---------------------------------------------------------
create function public.is_crew_member(target_crew_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.crew_members
    where crew_id = target_crew_id and user_id = target_user_id
  );
$$;

create function public.is_crew_owner(target_crew_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.crews
    where id = target_crew_id and owner_id = target_user_id
  );
$$;

-- "Is this other person in any crew with me?" Used to let crew mates see each
-- other's name and main car, without opening those tables to everyone.
create function public.shares_crew_with(other_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.crew_members me
    join public.crew_members them on them.crew_id = me.crew_id
    where me.user_id = (select auth.uid())
      and them.user_id = other_user_id
  );
$$;

revoke execute on function public.is_crew_member(uuid, uuid) from public, anon;
revoke execute on function public.is_crew_owner(uuid, uuid) from public, anon;
revoke execute on function public.shares_crew_with(uuid) from public, anon;
grant execute on function public.is_crew_member(uuid, uuid) to authenticated;
grant execute on function public.is_crew_owner(uuid, uuid) to authenticated;
grant execute on function public.shares_crew_with(uuid) to authenticated;


-- 4. Rules for crews ----------------------------------------------------------
alter table public.crews enable row level security;

create policy "Members can read their crews"
  on public.crews for select
  to authenticated
  using (public.is_crew_member(id, (select auth.uid())));

create policy "Users can create crews they own"
  on public.crews for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Owners can update their crew"
  on public.crews for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Owners can delete their crew"
  on public.crews for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

create trigger crews_set_updated_at
  before update on public.crews
  for each row execute function public.set_updated_at();

-- Whoever creates a crew is immediately its first member.
create function public.handle_new_crew()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.crew_members (crew_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

revoke execute on function public.handle_new_crew() from public, anon, authenticated;

create trigger crews_add_owner
  after insert on public.crews
  for each row execute function public.handle_new_crew();


-- 5. Rules for membership -----------------------------------------------------
alter table public.crew_members enable row level security;

create policy "Members can see who else is in their crews"
  on public.crew_members for select
  to authenticated
  using (public.is_crew_member(crew_id, (select auth.uid())));

-- Deliberately no insert policy: joining goes through join_crew_by_code below,
-- so nobody can add themselves to a crew whose id they happened to learn.

create policy "Members can leave, and owners can remove members"
  on public.crew_members for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_crew_owner(crew_id, (select auth.uid()))
  );


-- 6. Joining with a code ------------------------------------------------------
create function public.join_crew_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_crew uuid;
  joining_user uuid := (select auth.uid());
begin
  if joining_user is null then
    raise exception 'You need to be signed in to join a crew' using errcode = '28000';
  end if;

  select id into target_crew
    from public.crews
   where invite_code = upper(trim(code));

  if target_crew is null then
    raise exception 'No crew found with that code' using errcode = 'no_data_found';
  end if;

  insert into public.crew_members (crew_id, user_id, role)
  values (target_crew, joining_user, 'member')
  on conflict (crew_id, user_id) do nothing;

  return target_crew;
end;
$$;

revoke execute on function public.join_crew_by_code(text) from public, anon;
grant execute on function public.join_crew_by_code(text) to authenticated;


-- 7. What crew mates can see about each other ---------------------------------
-- Until now a profile was visible only to its owner. Crews are the point where
-- that has to open up a little: you should see the names of people you drive
-- with, and the car they've marked as their main one. Nothing else.
create policy "Crew mates can read each other's profiles"
  on public.profiles for select
  to authenticated
  using (public.shares_crew_with(id));

create policy "Crew mates can see each other's main car"
  on public.vehicles for select
  to authenticated
  using (is_primary and public.shares_crew_with(owner_id));

create policy "Crew mates can see photos of each other's main car"
  on public.vehicle_photos for select
  to authenticated
  using (
    exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id
        and v.is_primary
        and public.shares_crew_with(v.owner_id)
    )
  );
