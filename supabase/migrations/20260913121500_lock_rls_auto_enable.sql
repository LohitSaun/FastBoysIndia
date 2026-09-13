-- =============================================================================
-- Lock down public.rls_auto_enable()
--
-- Supabase created this function when we ticked "Enable automatic RLS" on the
-- project. It runs as SECURITY DEFINER (with its owner's powers), and by default
-- anyone with the app's public key could call it through the API. Supabase's
-- Security Advisor flags that as a warning.
--
-- The function is meant to be run only by Postgres itself (from an event trigger
-- whenever a table is created), never by app users, so we remove everyone else's
-- permission to call it. This is the same treatment as handle_new_user() in the
-- first migration. Postgres still runs it automatically whenever a table is created.
-- =============================================================================

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
