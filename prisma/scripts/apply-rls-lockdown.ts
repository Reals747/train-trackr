/**
 * Idempotent applier: enables RLS on every table in the public schema with no
 * anon/authenticated policies (locks down the Supabase Data API). Does not modify row data.
 *
 * Covers migrations:
 *   20260520190000_enable_rls_public_tables
 *   20260630120000_enable_rls_missing_public_tables
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

const RLS_MIGRATIONS = [
  "20260520190000_enable_rls_public_tables",
  "20260630120000_enable_rls_missing_public_tables",
] as const;

async function enableRlsOnTables(
  prisma: PrismaClient,
  tableNames: string[],
): Promise<void> {
  for (const tableName of tableNames) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "public"."${tableName.replace(/"/g, '""')}" ENABLE ROW LEVEL SECURITY`,
    );
  }
}

type RlsStatus = {
  public_tables: number;
  rls_enabled: number;
  rls_disabled: number;
};

async function readRlsStatus(prisma: PrismaClient): Promise<RlsStatus> {
  const rows = (await prisma.$queryRawUnsafe(`
    SELECT
      count(*)::int AS public_tables,
      count(*) FILTER (WHERE c.relrowsecurity)::int AS rls_enabled,
      count(*) FILTER (WHERE NOT c.relrowsecurity)::int AS rls_disabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  `)) as RlsStatus[];
  return rows[0];
}

async function listTablesWithoutRls(prisma: PrismaClient): Promise<string[]> {
  const rows = (await prisma.$queryRawUnsafe(`
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
    ORDER BY c.relname
  `)) as Array<{ table_name: string }>;
  return rows.map((r) => r.table_name);
}

async function markMigrationApplied(
  prisma: PrismaClient,
  migrationName: string,
  sql: string,
): Promise<void> {
  const checksum = createHash("sha256").update(sql).digest("hex");
  await prisma.$executeRawUnsafe(`
    INSERT INTO "_prisma_migrations"
      (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
    VALUES
      ('${randomUUID()}', '${checksum}', NOW(), '${migrationName}', NULL, NULL, NOW(), 1)
    ON CONFLICT (id) DO NOTHING
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "_prisma_migrations"
    SET finished_at = COALESCE(finished_at, NOW()),
        checksum = '${checksum}',
        applied_steps_count = 1,
        rolled_back_at = NULL
    WHERE migration_name = '${migrationName}'
  `);
}

async function verifyPrismaCanRead(prisma: PrismaClient): Promise<void> {
  const storeCount = await prisma.store.count();
  const userCount = await prisma.user.count();
  console.log(`[rls] Prisma smoke test OK — Store: ${storeCount}, User: ${userCount}`);
}

async function main() {
  const prisma = new PrismaClient({ log: ["warn", "error"] });

  const before = await readRlsStatus(prisma);
  console.log("[rls] before:", before);

  if (before.rls_disabled === 0) {
    console.log("[rls] ✔ RLS already enabled on all public tables. Nothing to do.");
    await verifyPrismaCanRead(prisma);
    await prisma.$disconnect();
    return;
  }

  const missing = await listTablesWithoutRls(prisma);
  console.log("[rls] tables without RLS:", missing.join(", "));

  // Target only tables that lack RLS (minimal locks; avoids deadlocks with live traffic).
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const pending = await listTablesWithoutRls(prisma);
    if (pending.length === 0) break;

    try {
      await enableRlsOnTables(prisma, pending);
      break;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const pgCode =
        err && typeof err === "object" && "meta" in err
          ? (err as { meta?: { code?: string } }).meta?.code
          : undefined;
      const isDeadlock = pgCode === "40P01" || /deadlock detected/i.test(message);
      if (!isDeadlock || attempt === maxAttempts) throw err;
      const delayMs = attempt * 2000;
      console.log(`[rls] deadlock on attempt ${attempt}, retrying in ${delayMs}ms…`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  for (const migrationName of RLS_MIGRATIONS) {
    const migrationSqlPath = join(
      process.cwd(),
      "prisma",
      "migrations",
      migrationName,
      "migration.sql",
    );
    const migrationSql = readFileSync(migrationSqlPath, "utf8");
    await markMigrationApplied(prisma, migrationName, migrationSql);
  }

  const after = await readRlsStatus(prisma);
  console.log("[rls] after:", after);

  if (after.rls_disabled > 0) {
    const stillMissing = await listTablesWithoutRls(prisma);
    throw new Error(
      `RLS not enabled on all public tables (${after.rls_disabled} still off): ${stillMissing.join(", ")}`,
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
