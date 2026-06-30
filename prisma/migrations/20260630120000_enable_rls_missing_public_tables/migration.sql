-- RLS lockdown for public tables added after 20260520190000_enable_rls_public_tables.
-- Intentionally adds NO policies for anon / authenticated: the Supabase Data API cannot
-- read or write rows. Prisma via DATABASE_URL (table owner) bypasses RLS as elsewhere.

ALTER TABLE "StoreProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScheduleBreakCompletion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScheduleDayCache" ENABLE ROW LEVEL SECURITY;

-- Safety net: enable RLS on any other public tables that may have been missed.
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
