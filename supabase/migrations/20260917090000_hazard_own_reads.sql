-- Reporting a hazard failed with a row-level security error.
--
-- report_hazard ends with "returning id", and Postgres applies SELECT rules to
-- anything a statement returns. public.hazards deliberately had no SELECT rule,
-- to keep reporters anonymous, so even the reporter couldn't get their own new
-- row back.
--
-- This adds a read rule limited to your own reports. Other people's reports
-- stay unreadable at the table level, and everyone still sees hazards only
-- through hazards_near(), which never returns who reported them.
create policy "Users can read their own reports"
  on public.hazards for select
  to authenticated
  using ((select auth.uid()) = reporter_id);
