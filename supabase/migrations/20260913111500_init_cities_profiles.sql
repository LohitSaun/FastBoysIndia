-- =============================================================================
-- Fast Boys India: first migration
--
--   1. PostGIS   geospatial support (maps, fog-of-war, "nearby" queries later)
--   2. cities    the launch cities; adding one later is a single INSERT
--   3. profiles  one row per user, created automatically at sign-up
--
-- Row Level Security (RLS) is ON for every table. With RLS on, a table returns
-- nothing unless a policy explicitly allows it. The app connects with a PUBLIC
-- key that anyone could extract from the app, so RLS is what actually keeps
-- users' data private. Every new table in later phases must enable RLS too.
-- =============================================================================


-- 1. PostGIS ------------------------------------------------------------------
-- Installed in the "extensions" schema (Supabase's convention) so its hundreds
-- of functions don't clutter our "public" schema.
create extension if not exists postgis with schema extensions;


-- 2. Cities -------------------------------------------------------------------
create table public.cities (
  -- A readable slug like 'mumbai' instead of a random id: easier to read in data
  -- and in code.
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null,
  state text not null,
  -- Approximate city centre. Used later for city-level map and leaderboard features.
  center extensions.geography(point, 4326) not null,
  -- Lets us add a city ahead of launching there, or pause one, without deleting data.
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.cities is
  'Launch cities. To add a city, INSERT a row; no app changes needed.';

-- POINT(longitude latitude): note that longitude comes FIRST in PostGIS.
insert into public.cities (id, name, state, center) values
  ('mumbai',    'Mumbai',    'Maharashtra', 'SRID=4326;POINT(72.8777 19.0760)'),
  ('delhi',     'Delhi',     'Delhi',       'SRID=4326;POINT(77.2090 28.6139)'),
  ('bangalore', 'Bangalore', 'Karnataka',   'SRID=4326;POINT(77.5946 12.9716)');

alter table public.cities enable row level security;

-- Any signed-in user can read active cities (for the home-city picker).
-- There are no insert/update/delete policies, so cities can only be changed
-- through migrations or the Supabase dashboard, never from the app.
create policy "Signed-in users can read active cities"
  on public.cities for select
  to authenticated
  using (is_active);


-- 3. Profiles -----------------------------------------------------------------
-- The phone number is deliberately NOT copied here. It stays in auth.users,
-- which the app's public key can never read. Profiles will become visible to
-- crew-mates in Phase 3, so only share-safe fields belong in this table.
create table public.profiles (
  -- Same id as the Supabase Auth user. Deleting the account deletes the profile.
  id uuid primary key references auth.users (id) on delete cascade,
  -- Null until onboarding. 2–30 characters, matching the app's validation.
  display_name text check (char_length(display_name) between 2 and 30),
  home_city_id text references public.cities (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- City leaderboards (Phase 5) will filter by home city; the index keeps that fast.
create index profiles_home_city_id_idx on public.profiles (home_city_id);

alter table public.profiles enable row level security;

-- `(select auth.uid())` rather than plain `auth.uid()`: Supabase recommends the
-- wrapped form because Postgres then evaluates it once per query, not once per row.
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- RLS controls WHICH rows a user can update; these grants control WHICH columns.
-- Users can change their name and home city, but not their id or timestamps.
revoke update on public.profiles from authenticated;
grant update (display_name, home_city_id) on public.profiles to authenticated;

-- Keep updated_at accurate on every change.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();


-- 4. Create a profile automatically for every new user --------------------------
-- Runs in the same transaction as the sign-up itself, so the profile row always
-- exists by the time the app asks for it.
create function public.handle_new_user()
returns trigger
language plpgsql
-- "security definer" runs the function with its owner's permissions, which it needs
-- to write to public.profiles when fired from the auth schema. An empty search_path
-- is the standard safety measure for security definer functions.
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

-- Only the trigger should ever run this function; nobody can call it through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
