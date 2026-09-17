-- =============================================================================
-- Phase 5c: breakdown alerts
--
-- You're on a drive with your crew and your car dies. This tells everyone on
-- that drive where you are, so they can turn round instead of driving further
-- away from you.
--
-- Why this table stores a location when live positions deliberately don't:
--
--   Live convoy positions travel over Realtime and are never written down, so
--   the app keeps no history of anyone's movements. A breakdown is the opposite
--   case on purpose. Someone who opens the app a minute later, or whose phone
--   loses signal and reconnects, still has to find out you're stranded — and a
--   Realtime message that already went past can't tell them. So one point gets
--   saved: where you stopped. A stopped car doesn't move, so one point is all
--   it ever needs; there's no trail here.
--
--   It is also the most deliberate thing in the app: nothing is written unless
--   you press the button and confirm, and only your crew can read it. You can
--   clear it, and it clears itself when the drive ends.
-- =============================================================================


create table public.breakdowns (
  id uuid primary key default gen_random_uuid(),
  convoy_id uuid not null references public.convoys (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Where the car stopped. Written once and never updated by a location watch.
  location extensions.geography(point, 4326) not null,
  -- Optional: "flat tyre", "out of fuel", "engine overheating".
  note text check (char_length(trim(note)) between 1 and 120),
  created_at timestamptz not null default now(),
  -- Null means still stranded.
  resolved_at timestamptz
);

comment on table public.breakdowns is
  'A car that has stopped during a convoy. Stores one location point, unlike live positions, so late arrivals still see it.';

-- One open breakdown per person per drive. Pressing the button twice updates
-- the existing one rather than piling up alerts.
create unique index breakdowns_one_open_per_user_idx
  on public.breakdowns (convoy_id, user_id)
  where resolved_at is null;

create index breakdowns_convoy_idx on public.breakdowns (convoy_id, created_at desc);


-- Rules ------------------------------------------------------------------------
alter table public.breakdowns enable row level security;

-- Same audience as the convoy itself: the crew it belongs to.
create policy "Crew members can see breakdowns on their drives"
  on public.breakdowns for select
  to authenticated
  using (
    public.is_crew_member(public.crew_of_convoy(convoy_id), (select auth.uid()))
  );

create policy "Crew members can report their own breakdown"
  on public.breakdowns for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_crew_member(public.crew_of_convoy(convoy_id), (select auth.uid()))
  );

-- Marking yourself sorted is an update. Only your own row.
create policy "You can clear your own breakdown"
  on public.breakdowns for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- It's a stored location, so you can also remove it outright, the same way the
-- explored map can be erased.
create policy "You can delete your own breakdown"
  on public.breakdowns for delete
  to authenticated
  using (user_id = (select auth.uid()));


-- Reporting --------------------------------------------------------------------
-- A function rather than a plain insert, so latitude and longitude are turned
-- into a point by the database, and so pressing the button again while already
-- stranded updates the existing alert instead of failing on the unique index.
create function public.report_breakdown(
  p_convoy_id uuid,
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
  alert_id uuid;
  here extensions.geography;
  clean_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  -- A drive that has already ended can't have a breakdown reported on it.
  if not exists (
    select 1 from public.convoys c where c.id = p_convoy_id and c.ended_at is null
  ) then
    raise exception 'That drive has already ended' using errcode = '22023';
  end if;

  here := extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography;

  insert into public.breakdowns (convoy_id, user_id, location, note)
  values (p_convoy_id, (select auth.uid()), here, clean_note)
  -- The index this targets only covers rows where resolved_at is null, which is
  -- exactly "you are already stranded on this drive".
  on conflict (convoy_id, user_id) where resolved_at is null
  do update set location = excluded.location, note = excluded.note
  returning id into alert_id;

  return alert_id;
end;
$$;

revoke execute on function public.report_breakdown(uuid, double precision, double precision, text) from public, anon;
grant execute on function public.report_breakdown(uuid, double precision, double precision, text) to authenticated;


-- Reading ----------------------------------------------------------------------
create type public.breakdown_alert as (
  id uuid,
  user_id uuid,
  display_name text,
  latitude double precision,
  longitude double precision,
  note text,
  created_at timestamptz,
  is_you boolean
);

-- SECURITY DEFINER so it can read the driver's name and pull the coordinates
-- out of the geography column in one go. It checks crew membership first, so it
-- answers nobody outside the crew.
create function public.breakdowns_for_convoy(p_convoy_id uuid)
returns setof public.breakdown_alert
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  asking_user uuid := (select auth.uid());
begin
  if asking_user is null then
    raise exception 'You need to be signed in' using errcode = '28000';
  end if;

  if not public.is_crew_member(public.crew_of_convoy(p_convoy_id), asking_user) then
    raise exception 'You are not in that crew' using errcode = '42501';
  end if;

  return query
  select
    b.id,
    b.user_id,
    p.display_name,
    extensions.st_y(b.location::extensions.geometry),
    extensions.st_x(b.location::extensions.geometry),
    b.note,
    b.created_at,
    (b.user_id = asking_user)
  from public.breakdowns b
  join public.profiles p on p.id = b.user_id
  where b.convoy_id = p_convoy_id
    and b.resolved_at is null
  order by b.created_at;
end;
$$;

revoke execute on function public.breakdowns_for_convoy(uuid) from public, anon;
grant execute on function public.breakdowns_for_convoy(uuid) to authenticated;


-- Ending a drive clears any breakdown still open on it, so a forgotten alert
-- doesn't follow the crew around. SECURITY DEFINER because whoever ends the
-- drive is usually not the person who broke down.
create function public.resolve_breakdowns_on_convoy_end()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ended_at is not null and old.ended_at is null then
    update public.breakdowns
       set resolved_at = new.ended_at
     where convoy_id = new.id
       and resolved_at is null;
  end if;
  return new;
end;
$$;

revoke execute on function public.resolve_breakdowns_on_convoy_end() from public, anon, authenticated;

create trigger convoys_resolve_breakdowns
  after update on public.convoys
  for each row execute function public.resolve_breakdowns_on_convoy_end();
