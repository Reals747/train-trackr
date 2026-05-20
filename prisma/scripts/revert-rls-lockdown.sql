-- Emergency rollback for migration 20260520190000_enable_rls_public_tables.
-- Does not delete or modify row data — only turns off RLS on public tables.
--
-- Run in Supabase SQL Editor or: psql $DATABASE_URL -f prisma/scripts/revert-rls-lockdown.sql

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DISABLE ROW LEVEL SECURITY', 'public', t);
  END LOOP;
END $$;
