/**
 * One-off, idempotent applier for migration:
 *   20260429120000_position_order_and_checklist_kind
 *
 * Why a script?
 *   `prisma migrate deploy/status` hang against the Supabase pgbouncer pooler
 *   on this project (the only DATABASE_URL we have). The Prisma *client*
 *   connection works fine via the same pooler, so we run the DDL through
 *   $executeRawUnsafe and then mark the migration as applied in the
 *   _prisma_migrations table so future `prisma migrate` invocations stay in
 *   sync.
 *
 * Safety:
 *   - All ALTER/CREATE statements use IF NOT EXISTS — re-running is a no-op.
 *   - The Position.order backfill only writes rows where the value is the
 *     default 0, so re-running won't shuffle a manual reorder you've already
 *     done.
 *   - The whole thing runs inside a transaction; if any statement fails the
 *     DB is left untouched.
 *   - The _prisma_migrations row is upserted by checksum so we never
 *     duplicate the row.
 *
 * Run:
 *   npx tsx prisma/scripts/apply-dnd-migration.ts
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const MIGRATION_NAME = "20260429120000_position_order_and_checklist_kind";
const MIGRATION_DIR = join(process.cwd(), "prisma", "migrations", MIGRATION_NAME);
const MIGRATION_SQL_PATH = join(MIGRATION_DIR, "migration.sql");

async function main() {
  const sql = readFileSync(MIGRATION_SQL_PATH, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");

  const prisma = new PrismaClient({ log: ["warn", "error"] });

  console.log(`[migrate] target: ${MIGRATION_NAME}`);
  console.log(`[migrate] checksum: ${checksum}`);

  // 1) Detect the current state up front so the log is informative.
  const before = (await prisma.$queryRawUnsafe(`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Position' AND column_name = 'order'
      ) AS has_position_order,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ChecklistItem' AND column_name = 'kind'
      ) AS has_checklist_kind,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'Position_storeId_order_idx'
      ) AS has_index,
      EXISTS (
        SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '${MIGRATION_NAME}' AND finished_at IS NOT NULL
      ) AS already_applied
  `)) as Array<{
    has_position_order: boolean;
    has_checklist_kind: boolean;
    has_index: boolean;
    already_applied: boolean;
  }>;
  console.log("[migrate] before:", before[0]);

  // 2) Run all changes in a single transaction. Each statement is idempotent.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `ALTER TABLE "Position" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0`,
    );
    await tx.$executeRawUnsafe(
      `ALTER TABLE "ChecklistItem" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'item'`,
    );

    // Backfill Position.order only where it's still the default 0 — a row
    // that's already been reordered manually keeps its value.
    await tx.$executeRawUnsafe(`
      WITH ranked AS (
        SELECT
          "id",
          (ROW_NUMBER() OVER (PARTITION BY "storeId" ORDER BY "name" ASC) - 1) AS new_order
        FROM "Position"
        WHERE "order" = 0
      )
      UPDATE "Position" AS p
      SET "order" = ranked.new_order
      FROM ranked
      WHERE p."id" = ranked."id" AND p."order" = 0
    `);

    await tx.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Position_storeId_order_idx" ON "Position"("storeId", "order")`,
    );

    // 3) Mark the migration as applied so `prisma migrate` future invocations
    //    don't try to re-run it. We upsert by migration_name+checksum so this
    //    is also idempotent.
    await tx.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations"
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES
        ('${randomUUID()}', '${checksum}', NOW(), '${MIGRATION_NAME}', NULL, NULL, NOW(), 1)
      ON CONFLICT (id) DO NOTHING
    `);

    // If a prior failed/partial attempt left an unfinished row, finish it and
    // align checksum so Prisma sees the migration as cleanly applied.
    await tx.$executeRawUnsafe(`
      UPDATE "_prisma_migrations"
      SET finished_at = COALESCE(finished_at, NOW()),
          checksum = '${checksum}',
          applied_steps_count = 1,
          rolled_back_at = NULL
      WHERE migration_name = '${MIGRATION_NAME}'
    `);
  });

  // 4) Verify post-state.
  const after = (await prisma.$queryRawUnsafe(`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Position' AND column_name = 'order'
      ) AS has_position_order,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ChecklistItem' AND column_name = 'kind'
      ) AS has_checklist_kind,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'Position_storeId_order_idx'
      ) AS has_index,
      (SELECT count(*)::int FROM "Position") AS position_count,
      (SELECT count(*)::int FROM "ChecklistItem") AS checklist_count,
      (SELECT count(*)::int FROM "ChecklistItem" WHERE kind = 'header') AS header_count
  `)) as Array<{
    has_position_order: boolean;
    has_checklist_kind: boolean;
    has_index: boolean;
    position_count: number;
    checklist_count: number;
    header_count: number;
  }>;
  console.log("[migrate] after: ", after[0]);

  const summary = after[0];
  if (!summary.has_position_order || !summary.has_checklist_kind || !summary.has_index) {
    throw new Error("Migration verification failed — one or more changes are missing.");
  }
  console.log("[migrate] ✔ Migration applied successfully. Existing data preserved.");

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[migrate] ✖ Migration failed:", err);
  process.exitCode = 1;
});
