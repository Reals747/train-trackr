-- Minimal RLS lockdown (no data changes).
--
-- Enables row level security on every table in the public schema.
-- Intentionally adds NO policies for anon / authenticated: the Supabase
-- Data API (PostgREST) cannot read or write any rows.
--
-- Prisma / server DATABASE_URL typically connects as the table owner (postgres),
-- which bypasses RLS in Postgres unless FORCE ROW LEVEL SECURITY is used (we do not).
--
-- Revert (emergency): run prisma/scripts/revert-rls-lockdown.sql in the SQL editor,
-- or disable RLS per table: ALTER TABLE "Store" DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', 'public', t);
  END LOOP;
END $$;
