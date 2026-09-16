-- =============================================================================
-- Phase 4: drives and the explored map
--
--   trips             one recorded drive: when, how far, how long, which car
--   explored_squares  the ~100m squares a user has driven through, ever
--
-- The explored map is a grid, not real roads. The world is cut into squares of
-- 0.001 degrees (about 110m north-south, and about 105m east-west at Indian
-- latitudes). Any square you pass through is yours forever. This is cheap to
-- store, quick to draw, and gives a number worth ranking people by later.
--
-- What is deliberately NOT stored: the individual GPS readings. Each drive
-- keeps one simplified line, so there's no second-by-second log of anyone's
-- movements sitting in the database.
-- =============================================================================


-- 1. Drives -------------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Keep the drive if the car is later deleted; it just loses the link.
  vehicle_id uuid references public.vehicles (id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  distance_m integer not null default 0 check (distance_m >= 0),
  duration_s integer not null default 0 check (duration_s >= 0),
  max_speed_kph smallint check (max_speed_kph between 0 and 400),
  -- The simplified path, for drawing the drive on a map.
  route extensions.geography(linestring, 4326),
  created_at timestamptz not null default now(),
  check (ended_at >= started_at)
);

create index trips_user_idx on public.trips (user_id, started_at desc);
create index trips_vehicle_idx on public.trips (vehicle_id);

alter table public.trips enable row level security;

create policy "Users can read their own drives"
  on public.trips for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can record their own drives"
  on public.trips for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own drives"
  on public.trips for delete
  to authenticated
  using ((select auth.uid()) = user_id);


-- 2. The explored map ----------------------------------------------------------
create table public.explored_squares (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- floor(latitude / 0.001) and floor(longitude / 0.001)
  cell_x integer not null,
  cell_y integer not null,
  first_seen_at timestamptz not null default now(),
  primary key (user_id, cell_x, cell_y)
);

comment on table public.explored_squares is
  'One row per ~100m square a user has driven through. The primary key makes re-driving the same road free.';

alter table public.explored_squares enable row level security;

create policy "Users can read their own explored map"
  on public.explored_squares for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add to their own explored map"
  on public.explored_squares for insert
  to authenticated
  with check ((select auth.uid()) = user_id);


-- 3. Saving a drive ------------------------------------------------------------
-- One call instead of dozens: the drive and every square it touched are written
-- together, so a half-saved drive can't happen. SECURITY INVOKER means the
-- usual row rules still apply, and the car is checked to be the caller's own.
create function public.record_trip(
  p_vehicle_id uuid,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_distance_m integer,
  p_duration_s integer,
  p_max_speed_kph smallint,
  p_route_geojson jsonb,
  p_cells jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_trip_id uuid;
begin
  if current_user_id is null then
    raise exception 'You need to be signed in to record a drive' using errcode = '28000';
  end if;

  if p_vehicle_id is not null and not exists (
    select 1 from public.vehicles
     where id = p_vehicle_id and owner_id = current_user_id
  ) then
    raise exception 'That car is not yours' using errcode = '42501';
  end if;

  insert into public.trips (
    user_id, vehicle_id, started_at, ended_at,
    distance_m, duration_s, max_speed_kph, route
  )
  values (
    current_user_id, p_vehicle_id, p_started_at, p_ended_at,
    p_distance_m, p_duration_s, p_max_speed_kph,
    case
      when p_route_geojson is null then null
      else extensions.st_geomfromgeojson(p_route_geojson::text)::extensions.geography
    end
  )
  returning id into new_trip_id;

  if p_cells is not null then
    insert into public.explored_squares (user_id, cell_x, cell_y)
    select current_user_id, (cell ->> 0)::int, (cell ->> 1)::int
      from jsonb_array_elements(p_cells) as cell
    on conflict (user_id, cell_x, cell_y) do nothing;
  end if;

  return new_trip_id;
end;
$$;

revoke execute on function public.record_trip(uuid, timestamptz, timestamptz, integer, integer, smallint, jsonb, jsonb) from public, anon;
grant execute on function public.record_trip(uuid, timestamptz, timestamptz, integer, integer, smallint, jsonb, jsonb) to authenticated;


-- 4. Totals --------------------------------------------------------------------
-- security_invoker means these views obey the same row rules as the tables, so
-- each person only ever sees their own numbers.
create view public.my_trip_stats with (security_invoker = on) as
  select
    user_id,
    count(*)::int as trips,
    coalesce(sum(distance_m), 0)::bigint as total_distance_m,
    coalesce(sum(duration_s), 0)::bigint as total_duration_s,
    coalesce(max(max_speed_kph), 0)::int as best_speed_kph
  from public.trips
  group by user_id;

create view public.my_explored_stats with (security_invoker = on) as
  select user_id, count(*)::int as squares
  from public.explored_squares
  group by user_id;
