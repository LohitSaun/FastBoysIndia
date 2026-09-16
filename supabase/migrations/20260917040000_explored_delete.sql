-- Users can erase their own explored map.
--
-- Missed in the previous migration: squares could be added but never removed,
-- so there was no way to undo "where I have driven". That's someone's location
-- history, and they should be able to wipe it.
create policy "Users can erase their own explored map"
  on public.explored_squares for delete
  to authenticated
  using ((select auth.uid()) = user_id);
