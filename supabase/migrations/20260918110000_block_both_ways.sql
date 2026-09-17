-- =============================================================================
-- Blocking should work in both directions.
--
-- As first written, blocking somebody only hid their clips from you. But the
-- reason people block is usually that somebody is targeting them, and leaving
-- that person able to keep watching everything you post is exactly the wrong
-- half to fix. So a block now hides the clips both ways.
--
-- The person blocked is still not told, and their own clips stay up for
-- everybody else. From their side it simply looks as though you stopped
-- posting.
-- =============================================================================

create or replace function public.feed_page(
  p_before timestamptz default null,
  p_limit integer default 10,
  p_city_id text default null
)
returns setof public.feed_post
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

  return query
  select
    p.id,
    p.author_id,
    pr.display_name,
    (
      select coalesce(v.nickname, v.make || ' ' || v.model)
        from public.vehicles v
       where v.id = p.vehicle_id
    ) as main_car,
    p.video_path,
    p.thumbnail_path,
    p.caption,
    p.city_id,
    p.duration_s,
    p.created_at,
    (p.author_id = asking_user) as is_yours,
    exists (
      select 1 from public.post_reports r
       where r.post_id = p.id and r.reporter_id = asking_user
    ) as reported_by_you
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where p.removed_at is null
    and (p_before is null or p.created_at < p_before)
    and (p_city_id is null or p.city_id = p_city_id)
    -- Either direction of a block hides the clip. Your own posts are never
    -- hidden from you, whatever anyone else has done.
    and (
      p.author_id = asking_user
      or not exists (
        select 1 from public.blocked_users b
         where (b.blocker_id = asking_user and b.blocked_id = p.author_id)
            or (b.blocker_id = p.author_id and b.blocked_id = asking_user)
      )
    )
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 30);
end;
$$;

revoke execute on function public.feed_page(timestamptz, integer, text) from public, anon;
grant execute on function public.feed_page(timestamptz, integer, text) to authenticated;
