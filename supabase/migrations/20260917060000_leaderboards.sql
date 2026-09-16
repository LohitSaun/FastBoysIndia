-- =============================================================================
-- Phase 5a: leaderboards
--
-- The privacy problem this solves:
--
-- Drives and explored squares are private to their owner, and they should stay
-- that way. A leaderboard, though, has to compare people. Rather than opening
-- those tables up with a rule like "anyone in your city can read your trips",
-- the rankings come out of two functions that return ONLY what a leaderboard
-- shows: a name, a main car, totals and a position. No routes, no individual
-- drives, no squares, no timestamps of where somebody was.
--
-- The functions are SECURITY DEFINER, so they can read across users, and each
-- one checks who is asking before answering.
-- =============================================================================


-- Which city is the person asking from? Used to stop people browsing other
-- cities' boards is NOT the intent — city boards are public to signed-in users.
-- This exists so the app can default to your own city.
create function public.my_home_city()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select home_city_id from public.profiles where id = (select auth.uid());
$$;

revoke execute on function public.my_home_city() from public, anon;
grant execute on function public.my_home_city() to authenticated;


-- A row of a leaderboard.
create type public.leaderboard_row as (
  user_id uuid,
  display_name text,
  main_car text,
  distance_m bigint,
  squares integer,
  trips integer,
  is_you boolean
);


-- Period is either 'all' or a month like '2026-09'.
create function public.leaderboard_for_city(
  p_city_id text,
  p_period text default 'all',
  p_limit integer default 50
)
returns setof public.leaderboard_row
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  asking_user uuid := (select auth.uid());
  period_start timestamptz;
  period_end timestamptz;
begin
  if asking_user is null then
    raise exception 'You need to be signed in' using errcode = '28000';
  end if;

  if p_period = 'all' then
    period_start := '-infinity';
    period_end := 'infinity';
  elsif p_period ~ '^\d{4}-\d{2}$' then
    period_start := to_timestamp(p_period || '-01', 'YYYY-MM-DD');
    period_end := period_start + interval '1 month';
  else
    raise exception 'Period must be ''all'' or a month like 2026-09' using errcode = '22023';
  end if;

  return query
  select
    p.id,
    p.display_name,
    (
      select coalesce(v.nickname, v.make || ' ' || v.model)
        from public.vehicles v
       where v.owner_id = p.id and v.is_primary
       limit 1
    ) as main_car,
    coalesce(sum(t.distance_m), 0)::bigint as distance_m,
    (
      select count(*)::int from public.explored_squares e
       where e.user_id = p.id
         and (p_period = 'all' or (e.first_seen_at >= period_start and e.first_seen_at < period_end))
    ) as squares,
    count(t.id)::int as trips,
    (p.id = asking_user) as is_you
  from public.profiles p
  left join public.trips t
    on t.user_id = p.id
   and t.started_at >= period_start
   and t.started_at < period_end
  where p.home_city_id = p_city_id
    and p.display_name is not null
  group by p.id, p.display_name
  -- Someone with no drives at all isn't on the board.
  having coalesce(sum(t.distance_m), 0) > 0
  order by coalesce(sum(t.distance_m), 0) desc
  limit least(greatest(p_limit, 1), 200);
end;
$$;

revoke execute on function public.leaderboard_for_city(text, text, integer) from public, anon;
grant execute on function public.leaderboard_for_city(text, text, integer) to authenticated;


create function public.leaderboard_for_crew(
  p_crew_id uuid,
  p_period text default 'all',
  p_limit integer default 50
)
returns setof public.leaderboard_row
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  asking_user uuid := (select auth.uid());
  period_start timestamptz;
  period_end timestamptz;
begin
  if asking_user is null then
    raise exception 'You need to be signed in' using errcode = '28000';
  end if;

  -- Crew boards are for members only.
  if not public.is_crew_member(p_crew_id, asking_user) then
    raise exception 'You are not in that crew' using errcode = '42501';
  end if;

  if p_period = 'all' then
    period_start := '-infinity';
    period_end := 'infinity';
  elsif p_period ~ '^\d{4}-\d{2}$' then
    period_start := to_timestamp(p_period || '-01', 'YYYY-MM-DD');
    period_end := period_start + interval '1 month';
  else
    raise exception 'Period must be ''all'' or a month like 2026-09' using errcode = '22023';
  end if;

  return query
  select
    p.id,
    p.display_name,
    (
      select coalesce(v.nickname, v.make || ' ' || v.model)
        from public.vehicles v
       where v.owner_id = p.id and v.is_primary
       limit 1
    ) as main_car,
    coalesce(sum(t.distance_m), 0)::bigint as distance_m,
    (
      select count(*)::int from public.explored_squares e
       where e.user_id = p.id
         and (p_period = 'all' or (e.first_seen_at >= period_start and e.first_seen_at < period_end))
    ) as squares,
    count(t.id)::int as trips,
    (p.id = asking_user) as is_you
  from public.crew_members m
  join public.profiles p on p.id = m.user_id
  left join public.trips t
    on t.user_id = p.id
   and t.started_at >= period_start
   and t.started_at < period_end
  where m.crew_id = p_crew_id
  group by p.id, p.display_name
  order by coalesce(sum(t.distance_m), 0) desc
  limit least(greatest(p_limit, 1), 200);
end;
$$;

revoke execute on function public.leaderboard_for_crew(uuid, text, integer) from public, anon;
grant execute on function public.leaderboard_for_crew(uuid, text, integer) to authenticated;


-- Ranking reads a lot of one person's trips at a time; this keeps that cheap.
create index if not exists trips_user_started_idx on public.trips (user_id, started_at);
create index if not exists explored_squares_seen_idx on public.explored_squares (user_id, first_seen_at);
