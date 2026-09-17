-- =============================================================================
-- Deleting your account
--
-- Apple requires that an app which lets you create an account also lets you
-- delete it from inside the app, and that it really deletes rather than
-- deactivates. India's DPDP Act points the same way.
--
-- Everything that belongs to a person already disappears with them, because
-- every table's foreign key to auth.users cascades. Two of those cascades were
-- wrong, though, and this migration fixes both before adding the function:
--
--   crews.owner_id   Deleting the owner destroyed the whole crew, taking
--                    everybody else's membership with it. Leaving should never
--                    delete other people's things, so ownership is handed over
--                    instead — and the crew is only deleted if the owner is the
--                    last one in it.
--
--   hazards.reporter_id  A pothole or a speed camera is community safety data
--                    that happens to be anonymous already. Wiping somebody's
--                    reports off everyone's map when they leave helps nobody.
--                    What deletion is actually about is the link to the person,
--                    so the link is removed and the hazard stays.
--
-- No Edge Function and no service key in the app: this runs as the migration's
-- owner, which has the rights to remove the auth row.
-- =============================================================================


-- 1. A hazard outlives the person who reported it -------------------------------
alter table public.hazards alter column reporter_id drop not null;

alter table public.hazards drop constraint hazards_reporter_id_fkey;
alter table public.hazards add constraint hazards_reporter_id_fkey
  foreign key (reporter_id) references auth.users (id) on delete set null;

comment on column public.hazards.reporter_id is
  'Who reported it, for abuse handling. Never returned by hazards_near(), and set to null if they delete their account.';


-- hazards_near compared reporter_id to the caller directly, which now has a
-- null to deal with: null = <uuid> is null, not false, and "reported_by_you"
-- must be a straight yes or no.
create or replace function public.hazards_near(
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
    coalesce(h.reporter_id = asking_user, false)
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


-- 2. Deleting the account --------------------------------------------------------
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  owned record;
  heir uuid;
begin
  if me is null then
    raise exception 'You need to be signed in' using errcode = '28000';
  end if;

  -- Hand over every crew you own before the cascade can destroy it.
  for owned in select id from public.crews where owner_id = me loop
    -- The longest-standing other member takes it on.
    select cm.user_id into heir
      from public.crew_members cm
     where cm.crew_id = owned.id and cm.user_id <> me
     order by cm.joined_at
     limit 1;

    if heir is null then
      -- Nobody else is in it, so there is nothing to hand over.
      delete from public.crews where id = owned.id;
    else
      update public.crews set owner_id = heir where id = owned.id;
      update public.crew_members set role = 'owner'
       where crew_id = owned.id and user_id = heir;
      delete from public.crew_members where crew_id = owned.id and user_id = me;
    end if;
  end loop;

  -- Everything else goes with the auth row: profile, cars, photos rows, mods,
  -- drives, explored squares, crew memberships, convoys, breakdowns, posts,
  -- reports, blocks and the subscription. Hazards survive, without the link.
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'Deletes the signed-in user and everything of theirs. Crews they own are handed to the longest-standing member. Storage files are removed by the app first, because the database cannot reach them.';
