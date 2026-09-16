-- =============================================================================
-- Phase 5b: hazards, speed cameras, and the first piece of subscriptions
--
-- Two ideas here that are worth reading before the SQL.
--
-- 1. Reports are anonymous. The reporter is recorded so abuse can be dealt with
--    later, but the table is never readable directly: every read goes through
--    hazards_near(), which returns the hazard and not who reported it. There is
--    deliberately no SELECT policy on public.hazards.
--
-- 2. Speed cameras are a paid feature, and the check lives here rather than in
--    the app. Hiding a button proves nothing; anyone can call the API directly.
--    Billing doesn't exist yet, so subscriptions.tier is simply set by hand for
--    now, and a payment provider will set it later.
-- =============================================================================


-- 1. Who has paid ---------------------------------------------------------------
create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'pro', 'premium')),
  -- Null means it doesn't expire. A past date means they've lapsed to free.
  valid_until timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.subscriptions is
  'Entitlements only. No app code writes here; a billing provider will, later.';

alter table public.subscriptions enable row level security;

-- People can see their own tier. Nobody can change it from the app: there are
-- no insert or update policies, on purpose.
create policy "Users can read their own subscription"
  on public.subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

/** 'free', 'pro' or 'premium' for whoever is asking, taking expiry into account. */
create function public.current_tier()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (
      select case
               when s.valid_until is null or s.valid_until > now() then s.tier
               else 'free'
             end
        from public.subscriptions s
       where s.user_id = (select auth.uid())
    ),
    'free'
  );
$$;

revoke execute on function public.current_tier() from public, anon;
grant execute on function public.current_tier() to authenticated;


-- 2. Hazards --------------------------------------------------------------------
create table public.hazards (
  id uuid primary key default gen_random_uuid(),
  -- Kept for dealing with abuse. Never returned to other users.
  reporter_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('pothole', 'waterlogging', 'fog', 'speed_camera', 'other')),
  location extensions.geography(point, 4326) not null,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- Set when enough people say it's gone.
  removed_at timestamptz
);

-- Finding hazards near a point is the only read pattern, so the location gets
-- a spatial index.
create index hazards_location_idx on public.hazards using gist (location);
create index hazards_live_idx on public.hazards (expires_at) where removed_at is null;

alter table public.hazards enable row level security;

-- No SELECT policy anywhere: reading happens only through hazards_near().
create policy "Users can report hazards as themselves"
  on public.hazards for insert
  to authenticated
  with check ((select auth.uid()) = reporter_id);

create policy "Users can remove their own report"
  on public.hazards for delete
  to authenticated
  using ((select auth.uid()) = reporter_id);


-- 3. "Still there" / "it's gone" -------------------------------------------------
create table public.hazard_votes (
  hazard_id uuid not null references public.hazards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  vote text not null check (vote in ('still_there', 'gone')),
  created_at timestamptz not null default now(),
  primary key (hazard_id, user_id)
);

alter table public.hazard_votes enable row level security;

create policy "Users can vote as themselves"
  on public.hazard_votes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can change their own vote"
  on public.hazard_votes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can read their own votes"
  on public.hazard_votes for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Three people saying it's gone is enough to take it off the map.
create function public.retire_hazard_when_gone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.vote = 'gone' then
    update public.hazards h
       set removed_at = now()
     where h.id = new.hazard_id
       and h.removed_at is null
       and (
         select count(*) from public.hazard_votes v
          where v.hazard_id = new.hazard_id and v.vote = 'gone'
       ) >= 3;
  end if;
  return new;
end;
$$;

revoke execute on function public.retire_hazard_when_gone() from public, anon, authenticated;

create trigger hazard_votes_retire
  after insert or update on public.hazard_votes
  for each row execute function public.retire_hazard_when_gone();


-- 4. Reporting -------------------------------------------------------------------
-- How long each kind stays on the map before fading out by itself.
create function public.hazard_lifetime(p_kind text)
returns interval
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'fog' then interval '6 hours'
    when 'waterlogging' then interval '1 day'
    when 'pothole' then interval '60 days'
    when 'speed_camera' then interval '365 days'
    else interval '7 days'
  end;
$$;

create function public.report_hazard(
  p_kind text,
  p_latitude double precision,
  p_longitude double precision,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  insert into public.hazards (reporter_id, kind, location, note, expires_at)
  values (
    (select auth.uid()),
    p_kind,
    extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
    nullif(trim(coalesce(p_note, '')), ''),
    now() + public.hazard_lifetime(p_kind)
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.report_hazard(text, double precision, double precision, text) from public, anon;
grant execute on function public.report_hazard(text, double precision, double precision, text) to authenticated;


-- 5. Reading hazards ---------------------------------------------------------------
create type public.hazard_nearby as (
  id uuid,
  kind text,
  latitude double precision,
  longitude double precision,
  note text,
  created_at timestamptz,
  gone_votes integer,
  metres_away double precision,
  reported_by_you boolean
);

/**
 * Hazards within a radius of a point.
 *
 * Speed cameras are only included for paying users. The "free users can see
 * camera pins but only subscribers get the driving alert" split is done in the
 * app by asking for cameras or not; this flag is the hard limit behind it.
 */
create function public.hazards_near(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_m integer default 5000,
  p_include_cameras boolean default true
)
returns setof public.hazard_nearby
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  asking_user uuid := (select auth.uid());
  here extensions.geography;
  is_subscriber boolean;
begin
  if asking_user is null then
    raise exception 'You need to be signed in' using errcode = '28000';
  end if;

  here := extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography;
  is_subscriber := public.current_tier() in ('pro', 'premium');

  return query
  select
    h.id,
    h.kind,
    extensions.st_y(h.location::extensions.geometry),
    extensions.st_x(h.location::extensions.geometry),
    h.note,
    h.created_at,
    (select count(*)::int from public.hazard_votes v where v.hazard_id = h.id and v.vote = 'gone'),
    extensions.st_distance(h.location, here),
    (h.reporter_id = asking_user)
  from public.hazards h
  where h.removed_at is null
    and h.expires_at > now()
    and extensions.st_dwithin(h.location, here, least(greatest(p_radius_m, 100), 50000))
    and (h.kind <> 'speed_camera' or (is_subscriber and p_include_cameras))
  order by extensions.st_distance(h.location, here)
  limit 200;
end;
$$;

revoke execute on function public.hazards_near(double precision, double precision, integer, boolean) from public, anon;
grant execute on function public.hazards_near(double precision, double precision, integer, boolean) to authenticated;


create function public.vote_hazard(p_hazard_id uuid, p_vote text)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.hazard_votes (hazard_id, user_id, vote)
  values (p_hazard_id, (select auth.uid()), p_vote)
  on conflict (hazard_id, user_id) do update set vote = excluded.vote, created_at = now();
$$;

revoke execute on function public.vote_hazard(uuid, text) from public, anon;
grant execute on function public.vote_hazard(uuid, text) to authenticated;
