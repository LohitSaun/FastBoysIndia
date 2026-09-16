-- =============================================================================
-- Two corrections to the crew rules, found by testing against the real database.
--
-- 1. Creating a crew failed. The "you may read a crew if you're a member" rule
--    was also applied to the row handed back right after the insert, and the
--    membership row is only added a moment later by a trigger. An owner should
--    always be able to see their own crew anyway, so the rule now accepts
--    either owning it or being a member of it.
--
-- 2. The owner could leave their own crew, which left a crew with no owner
--    inside it. Owners now delete the crew instead of leaving it.
-- =============================================================================

drop policy "Members can read their crews" on public.crews;

create policy "Owners and members can read their crews"
  on public.crews for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or public.is_crew_member(id, (select auth.uid()))
  );

drop policy "Members can leave, and owners can remove members" on public.crew_members;

create policy "Members can leave, and owners can remove other members"
  on public.crew_members for delete
  to authenticated
  using (
    -- Leave a crew you're in, unless you own it.
    (user_id = (select auth.uid()) and not public.is_crew_owner(crew_id, user_id))
    -- Or, as the owner, remove somebody else.
    or (
      public.is_crew_owner(crew_id, (select auth.uid()))
      and user_id <> (select auth.uid())
    )
  );
