/**
 * Idempotent applier for migration 20260619120000_schedule_day_cache.
 * See apply-dnd-migration.ts — `prisma migrate deploy/status` can hang on Supabase pgbouncer.
 *
 * Run: npx tsx prisma/scripts/apply-schedule-day-cache-migration.ts
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const MIGRATION_NAME = "20260619120000_schedule_day_cache";
const MIGRATION_SQL_PATH = join(
  process.cwd(),
  "prisma",
  "migrations",
  MIGRATION_NAME,
  "migration.sql",
);

async function main() {
  const sql = readFileSync(MIGRATION_SQL_PATH, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  const prisma = new PrismaClient({ log: ["warn", "error"] });

  console.log(`[migrate] target: ${MIGRATION_NAME}`);
  console.log(`[migrate] checksum: ${checksum}`);

  const before = (await prisma.$queryRawUnsafe(`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ScheduleDayCache'
      ) AS has_table,
      EXISTS (
        SELECT 1 FROM "_prisma_migrations"
        WHERE migration_name = '${MIGRATION_NAME}' AND finished_at IS NOT NULL
      ) AS already_applied
  `)) as Array<{ has_table: boolean; already_applied: boolean }>;
  console.log("[migrate] before:", before[0]);

  async function markMigrationApplied(tx: Pick<PrismaClient, "$executeRawUnsafe">) {
    await tx.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations"
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES
        ('${randomUUID()}', '${checksum}', NOW(), '${MIGRATION_NAME}', NULL, NULL, NOW(), 1)
      ON CONFLICT (id) DO NOTHING
    `);
    await tx.$executeRawUnsafe(`
      UPDATE "_prisma_migrations"
      SET finished_at = COALESCE(finished_at, NOW()),
          checksum = '${checksum}',
          applied_steps_count = 1,
          rolled_back_at = NULL
      WHERE migration_name = '${MIGRATION_NAME}'
    `);
  }

  if (before[0]?.has_table) {
    console.log("[migrate] table already present — ensuring migration row only.");
    await markMigrationApplied(prisma);
    console.log("[migrate] ✔ Migration already applied.");
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ScheduleDayCache" (
        "id" TEXT NOT NULL,
        "storeId" TEXT NOT NULL,
        "profileKey" TEXT NOT NULL,
        "dateKey" TEXT NOT NULL,
        "employees" JSONB NOT NULL,
        "source" TEXT NOT NULL,
        "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ScheduleDayCache_pkey" PRIMARY KEY ("id")
      )
    `);

    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ScheduleDayCache_storeId_profileKey_dateKey_idx"
      ON "ScheduleDayCache"("storeId", "profileKey", "dateKey")
    `);

    await tx.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ScheduleDayCache_storeId_profileKey_dateKey_key"
      ON "ScheduleDayCache"("storeId", "profileKey", "dateKey")
    `);

    await tx.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "ScheduleDayCache"
          ADD CONSTRAINT "ScheduleDayCache_storeId_fkey"
          FOREIGN KEY ("storeId") REFERENCES "Store"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);

    await markMigrationApplied(tx);
  });

  const after = (await prisma.$queryRawUnsafe(`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ScheduleDayCache'
      ) AS has_table
  `)) as Array<{ has_table: boolean }>;
  console.log("[migrate] after:", after[0]);

  if (!after[0]?.has_table) {
    throw new Error("Migration verification failed — ScheduleDayCache table missing.");
  }
  console.log("[migrate] ✔ Migration applied successfully. Existing data preserved.");

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[migrate] ✖ Migration failed:", err);
  process.exitCode = 1;
});
