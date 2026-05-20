/**
 * One-off, idempotent applier for migration:
 *   20260520190000_enable_rls_public_tables
 *
 * Enables RLS on all public tables with no anon/authenticated policies
 * (locks down the Supabase Data API). Does not modify row data.
 *
 * Why a script?
 *   `prisma migrate deploy` may hang against the Supabase pgbouncer pooler;
 *   the Prisma client connection works, so we run the DDL via $executeRawUnsafe.
 *
 * Run:
 *   npx tsx prisma/scripts/apply-rls-lockdown.ts
 *
 * Revert:
 *   Run prisma/scripts/revert-rls-lockdown.sql in Supabase SQL Editor (or psql).
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const MIGRATION_NAME = "20260520190000_enable_rls_public_tables";
const MIGRATION_DIR = join(process.cwd(), "prisma", "migrations", MIGRATION_NAME);
const MIGRATION_SQL_PATH = join(MIGRATION_DIR, "migration.sql");

type RlsStatus = {
  public_tables: number;
  rls_enabled: number;
  rls_disabled: number;
  already_applied: boolean;
};

async function readRlsStatus(prisma: PrismaClient): Promise<RlsStatus> {
  const rows = (await prisma.$queryRawUnsafe(`
    SELECT
      count(*)::int AS public_tables,
      count(*) FILTER (WHERE c.relrowsecurity)::int AS rls_enabled,
      count(*) FILTER (WHERE NOT c.relrowsecurity)::int AS rls_disabled,
      EXISTS (
        SELECT 1 FROM "_prisma_migrations"
        WHERE migration_name = '${MIGRATION_NAME}' AND finished_at IS NOT NULL
      ) AS already_applied
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  `)) as RlsStatus[];
  return rows[0];
}

async function verifyPrismaCanRead(prisma: PrismaClient): Promise<void> {
  const storeCount = await prisma.store.count();
  const userCount = await prisma.user.count();
  console.log(`[rls] Prisma smoke test OK — Store: ${storeCount}, User: ${userCount}`);
}

async function main() {
  const sql = readFileSync(MIGRATION_SQL_PATH, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");

  const prisma = new PrismaClient({ log: ["warn", "error"] });

  console.log(`[rls] target: ${MIGRATION_NAME}`);
  console.log(`[rls] checksum: ${checksum}`);

  const before = await readRlsStatus(prisma);
  console.log("[rls] before:", before);

  if (before.rls_disabled === 0 && before.already_applied) {
    console.log("[rls] ✔ RLS already enabled on all public tables. Nothing to do.");
    await verifyPrismaCanRead(prisma);
    await prisma.$disconnect();
    return;
  }

  await prisma.$executeRawUnsafe(sql);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "_prisma_migrations"
      (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
    VALUES
      ('${randomUUID()}', '${checksum}', NOW(), '${MIGRATION_NAME}', NULL, NULL, NOW(), 1)
    ON CONFLICT (id) DO NOTHING
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "_prisma_migrations"
    SET finished_at = COALESCE(finished_at, NOW()),
        checksum = '${checksum}',
        applied_steps_count = 1,
        rolled_back_at = NULL
    WHERE migration_name = '${MIGRATION_NAME}'
  `);

  const after = await readRlsStatus(prisma);
  console.log("[rls] after:", after);

  if (after.rls_disabled > 0) {
    throw new Error(
      `RLS not enabled on all public tables (${after.rls_disabled} still off).`,
    );
  }

  await verifyPrismaCanRead(prisma);
  console.log("[rls] ✔ RLS lockdown applied. Data unchanged; Supabase Data API blocked for anon/authenticated.");

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[rls] ✖ Failed:", err);
  process.exitCode = 1;
});
