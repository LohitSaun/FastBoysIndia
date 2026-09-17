-- =============================================================================
-- Phase 6a: the short-form video feed
--
--   posts          one short clip, with an optional caption and car
--   post_reports   somebody flagging a clip
--   blocked_users  somebody you never want to see again
--
-- The moment strangers can post video, three things stop being optional: a way
-- to report, a way to block, and a way for something to come down without a
-- human being awake. All three are here.
--
-- Note what is NOT here: likes, comments, follows. A feed people can post to
-- and report is the whole of v1. Everything social can be added later without
-- touching any of this.
-- =============================================================================


create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  -- Paths inside the private post-videos bucket, under <user id>/.
  video_path text not null,
  thumbnail_path text,
  caption text check (char_length(trim(caption)) between 1 and 150),
  -- Optional: which car is in the clip. Kept if the car is later deleted.
  vehicle_id uuid references public.vehicles (id) on delete set null,
  -- Copied from the author's profile when posting, so the feed can be filtered
  -- by city without joining profiles and without changing retrospectively when
  -- somebody moves.
  city_id text references public.cities (id),
  duration_s smallint check (duration_s between 1 and 60),
  created_at timestamptz not null default now(),
  -- Set when the author deletes it, or when enough people report it.
  removed_at timestamptz,
  removed_reason text check (removed_reason in ('author', 'reports'))
);

comment on table public.posts is
  'Short clips. Videos live in the private post-videos bucket; this holds the paths.';

create index posts_feed_idx on public.posts (created_at desc) where removed_at is null;
create index posts_city_idx on public.posts (city_id, created_at desc) where removed_at is null;
create index posts_author_idx on public.posts (author_id, created_at desc);


create table public.post_reports (
  post_id uuid not null references public.posts (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('unsafe_driving', 'not_a_car', 'offensive', 'spam', 'other')),
  created_at timestamptz not null default now(),
  -- One report per person per clip; reporting again changes your reason.
  primary key (post_id, reporter_id)
);

create index post_reports_post_idx on public.post_reports (post_id);


create table public.blocked_users (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  -- Blocking yourself would silently empty your own feed.
  check (blocker_id <> blocked_id)
);


-- Rules for posts ---------------------------------------------------------------
alter table public.posts enable row level security;

-- Anyone signed in can see clips that are still up. This is a public feed, so
-- the audience is deliberately wider than anything else in the app.
create policy "Signed-in users can see clips that are up"
  on public.posts for select
  to authenticated
  using (removed_at is null);

-- Authors keep seeing their own, including ones taken down, so the app can say
-- what happened instead of the clip silently vanishing.
create policy "Authors can always see their own clips"
  on public.posts for select
  to authenticated
  using ((select auth.uid()) = author_id);

create policy "Users can post as themselves"
  on public.posts for insert
  to authenticated
  with check ((select auth.uid()) = author_id);

create policy "Authors can take their own clip down"
  on public.posts for update
  to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

create policy "Authors can delete their own clip"
  on public.posts for delete
  to authenticated
  using ((select auth.uid()) = author_id);


-- Rules for reports -------------------------------------------------------------
alter table public.post_reports enable row level security;

-- You can see your own reports and nobody else's, so reporting stays private
-- and nobody can work out who flagged them.
create policy "Users can see their own reports"
  on public.post_reports for select
  to authenticated
  using ((select auth.uid()) = reporter_id);

create policy "Users can report as themselves"
  on public.post_reports for insert
  to authenticated
  with check ((select auth.uid()) = reporter_id);

create policy "Users can change their own report"
  on public.post_reports for update
  to authenticated
  using ((select auth.uid()) = reporter_id)
  with check ((select auth.uid()) = reporter_id);


-- Rules for blocks --------------------------------------------------------------
alter table public.blocked_users enable row level security;

create policy "Users can see who they have blocked"
  on public.blocked_users for select
  to authenticated
  using ((select auth.uid()) = blocker_id);

create policy "Users can block on their own behalf"
  on public.blocked_users for insert
  to authenticated
  with check ((select auth.uid()) = blocker_id);

create policy "Users can unblock"
  on public.blocked_users for delete
  to authenticated
  using ((select auth.uid()) = blocker_id);


-- Taking something down automatically -------------------------------------------
-- How many people have to report a clip before it comes down by itself. Low on
-- purpose: with nobody watching the queue overnight, the cost of hiding
-- something briefly is far lower than the cost of leaving it up.
create function public.post_report_threshold()
returns integer
language sql
immutable
set search_path = ''
as $$ select 3; $$;

create function public.hide_post_when_reported()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_count integer;
begin
  select count(*) into report_count
    from public.post_reports where post_id = new.post_id;

  if report_count >= public.post_report_threshold() then
    update public.posts
       set removed_at = now(), removed_reason = 'reports'
     where id = new.post_id and removed_at is null;
  end if;

  return new;
end;
$$;

revoke execute on function public.hide_post_when_reported() from public, anon, authenticated;

create trigger post_reports_hide_post
  after insert on public.post_reports
  for each row execute function public.hide_post_when_reported();


-- Reading the feed --------------------------------------------------------------
create type public.feed_post as (
  id uuid,
  author_id uuid,
  display_name text,
  main_car text,
  video_path text,
  thumbnail_path text,
  caption text,
  city_id text,
  duration_s smallint,
  created_at timestamptz,
  is_yours boolean,
  reported_by_you boolean
);

/**
 * A page of the feed.
 *
 * SECURITY DEFINER because it reads names and cars across everybody, which no
 * ordinary policy allows. It returns only what a feed row shows.
 *
 * Blocked people are filtered out here rather than in the app, so a blocked
 * person's clip never reaches the phone at all.
 *
 * Paging is by created_at rather than an offset: the feed gains rows at the top
 * while you scroll, and an offset would show you the same clip twice.
 */
create function public.feed_page(
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
    and not exists (
      select 1 from public.blocked_users b
       where b.blocker_id = asking_user and b.blocked_id = p.author_id
    )
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 30);
end;
$$;

revoke execute on function public.feed_page(timestamptz, integer, text) from public, anon;
grant execute on function public.feed_page(timestamptz, integer, text) to authenticated;


/** Reporting a clip. One row per person; reporting again changes the reason. */
create function public.report_post(p_post_id uuid, p_reason text)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.post_reports (post_id, reporter_id, reason)
  values (p_post_id, (select auth.uid()), p_reason)
  on conflict (post_id, reporter_id) do update set reason = excluded.reason, created_at = now();
$$;

revoke execute on function public.report_post(uuid, text) from public, anon;
grant execute on function public.report_post(uuid, text) to authenticated;


-- Where the videos live -----------------------------------------------------------
-- Private, like vehicle photos. The app plays them through short-lived signed
-- links, so a clip that is taken down stops being reachable rather than living
-- on at a public URL somebody saved.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-videos',
  'post-videos',
  false,
  62914560, -- 60MB. A 30-second clip off a phone lands well inside this.
  array['video/mp4', 'video/quicktime', 'image/jpeg']
)
on conflict (id) do nothing;

-- The first folder of the path is the owner's user id, which is what these
-- rules check — the same pattern the vehicle-photos bucket uses.
create policy "Users can upload their own clips"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'post-videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can replace their own clips"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'post-videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete their own clips"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'post-videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Reading is open to any signed-in user, because the feed is public and the app
-- asks for a signed link for whichever clip it is about to play.
create policy "Signed-in users can read clips"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'post-videos');
