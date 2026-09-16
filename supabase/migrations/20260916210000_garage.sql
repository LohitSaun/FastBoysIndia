-- =============================================================================
-- Phase 2: the digital garage
--
--   vehicles        one row per car
--   vehicle_photos  one row per photo (the files live in Supabase Storage)
--   modifications   one row per mod; a tune is just a mod in the 'tune' category
--   storage bucket  vehicle-photos (private)
--
-- Row Level Security is on for every table. For now a user can only see and
-- change their own cars. Phase 3 will widen reading to crew mates.
--
-- Photos and mods don't store an owner of their own: permission is checked
-- through the car they belong to, so nobody can attach a photo or a mod to
-- someone else's car.
-- =============================================================================


-- 1. Vehicles -----------------------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  make text not null check (char_length(trim(make)) between 1 and 40),
  model text not null check (char_length(trim(model)) between 1 and 40),
  -- Fixed upper bound rather than "this year + 1": Postgres only allows
  -- unchanging expressions in a check constraint.
  year smallint check (year between 1950 and 2100),
  nickname text check (char_length(trim(nickname)) between 1 and 30),
  -- The car shown on your profile, and later on your crew card.
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.vehicles is 'Cars in a user''s garage. Cars only in v1; no two-wheelers.';

create index vehicles_owner_id_idx on public.vehicles (owner_id, created_at desc);

-- At most one main car per owner, enforced by the database rather than by
-- hoping the app gets it right.
create unique index vehicles_one_primary_per_owner_idx
  on public.vehicles (owner_id)
  where is_primary;

alter table public.vehicles enable row level security;

create policy "Users can read their own vehicles"
  on public.vehicles for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Users can add their own vehicles"
  on public.vehicles for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

-- `using` decides which rows can be changed, `with check` what they may become,
-- so a car can't be handed to another account.
create policy "Users can update their own vehicles"
  on public.vehicles for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Users can delete their own vehicles"
  on public.vehicles for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();


-- 2. Vehicle photos -----------------------------------------------------------
create table public.vehicle_photos (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  -- Path inside the vehicle-photos bucket: <user id>/<vehicle id>/<random>.jpg
  storage_path text not null unique,
  -- Position 1 is the cover photo shown in the garage list.
  position smallint not null default 1 check (position between 1 and 10),
  created_at timestamptz not null default now()
);

create index vehicle_photos_vehicle_id_idx on public.vehicle_photos (vehicle_id, position);

alter table public.vehicle_photos enable row level security;

create policy "Users can read photos of their own vehicles"
  on public.vehicle_photos for select
  to authenticated
  using (
    exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.owner_id = (select auth.uid())
    )
  );

create policy "Users can add photos to their own vehicles"
  on public.vehicle_photos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.owner_id = (select auth.uid())
    )
  );

create policy "Users can update photos of their own vehicles"
  on public.vehicle_photos for update
  to authenticated
  using (
    exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.owner_id = (select auth.uid())
    )
  );

create policy "Users can delete photos of their own vehicles"
  on public.vehicle_photos for delete
  to authenticated
  using (
    exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.owner_id = (select auth.uid())
    )
  );

-- Cap of 10 photos per car. The app also checks, but the database is the place
-- that can't be bypassed.
create function public.enforce_vehicle_photo_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.vehicle_photos where vehicle_id = new.vehicle_id) >= 10 then
    raise exception 'A car can have at most 10 photos'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_vehicle_photo_limit() from public, anon, authenticated;

create trigger vehicle_photos_limit
  before insert on public.vehicle_photos
  for each row execute function public.enforce_vehicle_photo_limit();


-- 3. Modifications ------------------------------------------------------------
create table public.modifications (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  -- Fixed list so we can filter and count mods later; 'other' is the escape hatch.
  category text not null check (category in (
    'intake', 'exhaust', 'suspension', 'wheels', 'tyres',
    'brakes', 'tune', 'interior', 'exterior', 'other'
  )),
  title text not null check (char_length(trim(title)) between 1 and 60),
  brand text check (char_length(trim(brand)) <= 40),
  notes text check (char_length(notes) <= 500),
  installed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index modifications_vehicle_id_idx on public.modifications (vehicle_id, created_at desc);

alter table public.modifications enable row level security;

create policy "Users can read mods of their own vehicles"
  on public.modifications for select
  to authenticated
  using (
    exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.owner_id = (select auth.uid())
    )
  );

create policy "Users can add mods to their own vehicles"
  on public.modifications for insert
  to authenticated
  with check (
    exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.owner_id = (select auth.uid())
    )
  );

create policy "Users can update mods of their own vehicles"
  on public.modifications for update
  to authenticated
  using (
    exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.owner_id = (select auth.uid())
    )
  );

create policy "Users can delete mods of their own vehicles"
  on public.modifications for delete
  to authenticated
  using (
    exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.owner_id = (select auth.uid())
    )
  );

create trigger modifications_set_updated_at
  before update on public.modifications
  for each row execute function public.set_updated_at();


-- 4. Switching the main car ---------------------------------------------------
-- Two updates in one step, so there's never a moment with two main cars (which
-- the unique index above would reject anyway). SECURITY INVOKER means the
-- caller's own row-level permissions still apply: you can only affect your cars.
create function public.set_primary_vehicle(target_vehicle_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.vehicles
     set is_primary = false
   where owner_id = (select auth.uid())
     and is_primary
     and id <> target_vehicle_id;

  update public.vehicles
     set is_primary = true
   where id = target_vehicle_id
     and owner_id = (select auth.uid());
end;
$$;

revoke execute on function public.set_primary_vehicle(uuid) from public, anon;
grant execute on function public.set_primary_vehicle(uuid) to authenticated;


-- 5. Photo storage ------------------------------------------------------------
-- Private bucket: files are only reachable through short-lived signed links the
-- app requests, not by guessing a public URL. 5 MB ceiling per file, though the
-- app shrinks photos to roughly 300 KB before uploading.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-photos',
  'vehicle-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Every file sits in a folder named after its owner's user id, and these
-- policies simply check that first folder matches the person asking.
create policy "Users can read their own vehicle photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'vehicle-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can upload their own vehicle photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'vehicle-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can replace their own vehicle photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'vehicle-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'vehicle-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete their own vehicle photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'vehicle-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
