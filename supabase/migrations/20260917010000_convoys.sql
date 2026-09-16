-- =============================================================================
-- Phase 3b: convoys
--
--   convoys              a drive in progress, belonging to a crew
--   convoy_participants  who is on that drive
--
-- Live positions are NOT stored here. They travel over Supabase Realtime and
-- exist only while people are driving, so the app keeps no location history.
-- Recording trips is Phase 4, and that will be a deliberate, separate decision.
-- =============================================================================


create table public.convoys (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews (id) on delete cascade,
  started_by uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  -- Null means the convoy is still running.
  ended_at timestamptz
);

comment on table public.convoys is
  'A drive in progress. Live positions go over Realtime and are never stored.';

-- A crew can only have one convoy running at a time.
create unique index convoys_one_active_per_crew_idx
  on public.convoys (crew_id)
  where ended_at is null;

create index convoys_crew_idx on public.convoys (crew_id, started_at desc);

create table public.convoy_participants (
  convoy_id uuid not null references public.convoys (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (convoy_id, user_id)
);

create index convoy_participants_user_idx on public.convoy_participants (user_id);


-- Which crew does this convoy belong to? SECURITY DEFINER so that asking the
-- question from inside a rule doesn't re-trigger the rules on convoys.
create function public.crew_of_convoy(target_convoy_id uuid)
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select crew_id from public.convoys where id = target_convoy_id;
$$;

revoke execute on function public.crew_of_convoy(uuid) from public, anon;
grant execute on function public.crew_of_convoy(uuid) to authenticated;


-- Rules for convoys ------------------------------------------------------------
alter table public.convoys enable row level security;

create policy "Crew members can see their crew's convoys"
  on public.convoys for select
  to authenticated
  using (public.is_crew_member(crew_id, (select auth.uid())));

create policy "Crew members can start a convoy"
  on public.convoys for insert
  to authenticated
  with check (
    started_by = (select auth.uid())
    and public.is_crew_member(crew_id, (select auth.uid()))
  );

-- Ending a convoy is an update. Whoever started it, or the crew owner, may do it.
create policy "The starter or crew owner can end a convoy"
  on public.convoys for update
  to authenticated
  using (
    started_by = (select auth.uid())
    or public.is_crew_owner(crew_id, (select auth.uid()))
  )
  with check (
    started_by = (select auth.uid())
    or public.is_crew_owner(crew_id, (select auth.uid()))
  );


-- Rules for participants -------------------------------------------------------
alter table public.convoy_participants enable row level security;

create policy "Crew members can see who is on the drive"
  on public.convoy_participants for select
  to authenticated
  using (
    public.is_crew_member(public.crew_of_convoy(convoy_id), (select auth.uid()))
  );

create policy "Crew members can join a convoy as themselves"
  on public.convoy_participants for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_crew_member(public.crew_of_convoy(convoy_id), (select auth.uid()))
  );

create policy "You can update your own participation"
  on public.convoy_participants for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "You can remove your own participation"
  on public.convoy_participants for delete
  to authenticated
  using (user_id = (select auth.uid()));
