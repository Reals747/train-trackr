/**
 * Idempotent applier for migration 20260620120000_schedule_profile_filters.
 *
 * Run: npx tsx prisma/scripts/apply-schedule-profile-filters-migration.ts
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const MIGRATION_NAME = "20260620120000_schedule_profile_filters";
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
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'StoreProfile'
          AND column_name = 'scheduleLocationKeyword'
      ) AS has_profile_keywords,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ScheduleDayCache'
          AND column_name = 'shifts'
      ) AS has_shifts_column,
      EXISTS (
        SELECT 1 FROM "_prisma_migrations"
        WHERE migration_name = '${MIGRATION_NAME}' AND finished_at IS NOT NULL
      ) AS already_applied
  `)) as Array<{
    has_profile_keywords: boolean;
    has_shifts_column: boolean;
    already_applied: boolean;
  }>;
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

  if (before[0]?.has_profile_keywords && before[0]?.has_shifts_column) {
    console.log("[migrate] schema already present — ensuring migration row only.");
    await markMigrationApplied(prisma);
    console.log("[migrate] ✔ Migration already applied.");
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`
      ALTER TABLE "StoreProfile" ADD COLUMN IF NOT EXISTS "scheduleLocationKeyword" TEXT
    `);
    await tx.$executeRawUnsafe(`
      ALTER TABLE "StoreProfile" ADD COLUMN IF NOT EXISTS "scheduleDepartmentKeyword" TEXT
    `);

    await tx.$executeRawUnsafe(`DELETE FROM "ScheduleDayCache"`);

    await tx.$executeRawUnsafe(`
      DROP INDEX IF EXISTS "ScheduleDayCache_storeId_profileKey_dateKey_key"
    `);
    await tx.$executeRawUnsafe(`
      DROP INDEX IF EXISTS "ScheduleDayCache_storeId_profileKey_dateKey_idx"
    `);

    await tx.$executeRawUnsafe(`
      ALTER TABLE "ScheduleDayCache" DROP COLUMN IF EXISTS "profileKey"
    `);
    await tx.$executeRawUnsafe(`
      ALTER TABLE "ScheduleDayCache" DROP COLUMN IF EXISTS "source"
    `);

    await tx.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "ScheduleDayCache" RENAME COLUMN "employees" TO "shifts";
      EXCEPTION
        WHEN undefined_column THEN NULL;
      END $$
    `);

    await tx.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ScheduleDayCache_storeId_dateKey_key"
      ON "ScheduleDayCache"("storeId", "dateKey")
    `);
    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ScheduleDayCache_storeId_dateKey_idx"
      ON "ScheduleDayCache"("storeId", "dateKey")
    `);

    await markMigrationApplied(tx);
  });

  const after = (await prisma.$queryRawUnsafe(`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'StoreProfile'
          AND column_name = 'scheduleLocationKeyword'
      ) AS has_profile_keywords,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ScheduleDayCache'
          AND column_name = 'shifts'
      ) AS has_shifts_column
  `)) as Array<{ has_profile_keywords: boolean; has_shifts_column: boolean }>;
  console.log("[migrate] after:", after[0]);

  if (!after[0]?.has_profile_keywords || !after[0]?.has_shifts_column) {
    throw new Error("Migration verification failed — schedule profile filter columns missing.");
  }
  console.log("[migrate] ✔ Migration applied successfully. Schedule cache rows were cleared.");

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[migrate] ✖ Migration failed:", err);
  process.exitCode = 1;
});
