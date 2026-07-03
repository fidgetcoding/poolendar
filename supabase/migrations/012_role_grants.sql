-- Explicit privileges for the Supabase API roles.
-- Hosted Supabase configures default privileges so dashboard-created tables are
-- auto-granted to anon/authenticated/service_role; a schema recreated purely from
-- these migrations (local stack, fresh project) gets no DML grants at all, which
-- surfaces as PostgREST 403 "permission denied" (42501) even with a valid JWT.
-- Row access is still governed entirely by RLS policies — these are table-level
-- grants only, and every table in this schema has RLS enabled.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- Future objects created by the migration role inherit the same grants.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
