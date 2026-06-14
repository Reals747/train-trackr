/**
 * Idempotent applier for migration 20260614120000_store_profiles.
 * See apply-dnd-migration.ts for why this script exists.
 *
 * Run: npx tsx prisma/scripts/apply-store-profiles-migration.ts
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const MIGRATION_NAME = "20260614120000_store_profiles";
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
        WHERE table_schema = 'public' AND table_name = 'StoreProfile'
      ) AS has_store_profile,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Position' AND column_name = 'profileKey'
      ) AS has_profile_key,
      EXISTS (
        SELECT 1 FROM "_prisma_migrations"
        WHERE migration_name = '${MIGRATION_NAME}' AND finished_at IS NOT NULL
      ) AS already_applied
  `)) as Array<{
    has_store_profile: boolean;
    has_profile_key: boolean;
    already_applied: boolean;
  }>;
  console.log("[migrate] before:", before[0]);

  if (before[0]?.has_store_profile && before[0]?.has_profile_key) {
    console.log("[migrate] schema already present — ensuring migration row only.");
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
    console.log("[migrate] ✔ Migration already applied.");
    await prisma.$disconnect();
    return;
  }

  const executableSql = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  await prisma.$transaction(async (tx) => {
    const statements = executableSql
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    for (const statement of statements) {
      await tx.$executeRawUnsafe(`${statement};`);
    }

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
  });

  const after = (await prisma.$queryRawUnsafe(`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'StoreProfile'
      ) AS has_store_profile,
      (SELECT count(*)::int FROM "StoreProfile") AS profile_count
  `)) as Array<{ has_store_profile: boolean; profile_count: number }>;
  console.log("[migrate] after:", after[0]);

  if (!after[0]?.has_store_profile) {
    throw new Error("Migration verification failed — StoreProfile table missing.");
  }
  console.log("[migrate] ✔ Migration applied successfully.");

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[migrate] ✖ Migration failed:", err);
  process.exitCode = 1;
});
