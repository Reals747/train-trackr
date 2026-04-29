/**
 * One-off, idempotent applier for migration:
 *   20260429140000_add_website_developer_role
 *
 * What it does:
 *   1. Adds the `WEBSITE_DEVELOPER` value to the existing Postgres `Role`
 *      enum. Idempotent via `ADD VALUE IF NOT EXISTS`.
 *   2. Records the migration in `_prisma_migrations` so future
 *      `prisma migrate` runs see it as applied.
 *   3. Promotes the existing user with username `reals747` to the new role
 *      — but ONLY if there is exactly one such user across the database, to
 *      avoid accidentally promoting a same-named user in another store.
 *
 * Why a script?
 *   - `prisma migrate deploy/status` hangs against the Supabase pgbouncer
 *     pooler on this project; the Prisma client connection works fine
 *     through the same pooler so we go through `$executeRawUnsafe`.
 *   - `ALTER TYPE ... ADD VALUE` cannot be issued in the same transaction
 *     as a statement that USES the new value, so the enum addition runs
 *     outside any transaction and the role promotion runs in a separate
 *     transaction afterwards.
 *
 * Safety:
 *   - Re-running is a no-op (every step is guarded with IF NOT EXISTS or
 *     equivalent existence checks).
 *   - If 0 or >1 matching `reals747` users exist, the promotion step is
 *     SKIPPED with a clear log line; no rows are touched. Nothing else in
 *     the database is modified.
 *
 * Run:
 *   npx tsx prisma/scripts/apply-website-developer-role.ts
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const MIGRATION_NAME = "20260429140000_add_website_developer_role";
const MIGRATION_DIR = join(process.cwd(), "prisma", "migrations", MIGRATION_NAME);
const MIGRATION_SQL_PATH = join(MIGRATION_DIR, "migration.sql");
const TARGET_USERNAME = "reals747";

async function main() {
  const sql = readFileSync(MIGRATION_SQL_PATH, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");

  const prisma = new PrismaClient({ log: ["warn", "error"] });

  console.log(`[migrate] target: ${MIGRATION_NAME}`);
  console.log(`[migrate] checksum: ${checksum}`);

  // ── Phase 1: detect current state ────────────────────────────────────────
  const before = (await prisma.$queryRawUnsafe(`
    SELECT
      EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'Role' AND e.enumlabel = 'WEBSITE_DEVELOPER'
      ) AS has_enum_value,
      EXISTS (
        SELECT 1 FROM "_prisma_migrations"
        WHERE migration_name = '${MIGRATION_NAME}' AND finished_at IS NOT NULL
      ) AS already_applied
  `)) as Array<{ has_enum_value: boolean; already_applied: boolean }>;
  console.log("[migrate] before:", before[0]);

  // ── Phase 2: ALTER TYPE outside any transaction ──────────────────────────
  // (Postgres lets you ALTER TYPE ADD VALUE inside a transaction, but the new
  // label cannot be USED until that transaction commits — so we keep this
  // statement outside the bookkeeping transaction below.)
  await prisma.$executeRawUnsafe(
    `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'WEBSITE_DEVELOPER'`,
  );

  // ── Phase 3: record the migration in _prisma_migrations (idempotent) ─────
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations"
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      SELECT
        '${randomUUID()}', '${checksum}', NOW(), '${MIGRATION_NAME}', NULL, NULL, NOW(), 1
      WHERE NOT EXISTS (
        SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '${MIGRATION_NAME}'
      )
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

  // ── Phase 4: promote reals747 → WEBSITE_DEVELOPER (only if exactly one) ──
  // We deliberately match by lowercase username and IGNORE the role so this
  // works whether reals747 is currently OWNER, ADMIN, or TRAINER. We bail
  // out unless exactly one user matches across the entire database.
  const matches = (await prisma.$queryRawUnsafe(
    `SELECT id, username, role, "storeId" FROM "User" WHERE LOWER(username) = $1`,
    TARGET_USERNAME,
  )) as Array<{ id: string; username: string; role: string; storeId: string }>;

  if (matches.length === 0) {
    console.warn(
      `[migrate] ⚠ No user with username '${TARGET_USERNAME}' found — skipping role promotion. ` +
        `Re-run this script after the user is created and it will pick them up.`,
    );
  } else if (matches.length > 1) {
    console.warn(
      `[migrate] ⚠ Found ${matches.length} users with username '${TARGET_USERNAME}' across stores. ` +
        `Refusing to promote any of them automatically — promote the correct one by hand.`,
    );
    for (const m of matches) {
      console.warn(`        candidate: id=${m.id} role=${m.role} storeId=${m.storeId}`);
    }
  } else {
    const target = matches[0];
    if (target.role === "WEBSITE_DEVELOPER") {
      console.log(
        `[migrate] ✓ User ${target.username} (id=${target.id}) is already WEBSITE_DEVELOPER — no change.`,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET role = 'WEBSITE_DEVELOPER'::"Role" WHERE id = $1`,
        target.id,
      );
      console.log(
        `[migrate] ✓ Promoted ${target.username} (id=${target.id}, was=${target.role}) → WEBSITE_DEVELOPER.`,
      );
    }
  }

  // ── Phase 5: verification ────────────────────────────────────────────────
  const after = (await prisma.$queryRawUnsafe(`
    SELECT
      EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'Role' AND e.enumlabel = 'WEBSITE_DEVELOPER'
      ) AS has_enum_value,
      (SELECT count(*)::int FROM "User" WHERE role = 'WEBSITE_DEVELOPER') AS dev_count,
      (SELECT count(*)::int FROM "User") AS user_count,
      EXISTS (
        SELECT 1 FROM "_prisma_migrations"
        WHERE migration_name = '${MIGRATION_NAME}' AND finished_at IS NOT NULL
      ) AS recorded
  `)) as Array<{
    has_enum_value: boolean;
    dev_count: number;
    user_count: number;
    recorded: boolean;
  }>;
  console.log("[migrate] after: ", after[0]);

  if (!after[0].has_enum_value) {
    throw new Error(
      "[migrate] ✖ Verification failed: Role enum does NOT contain WEBSITE_DEVELOPER.",
    );
  }
  if (!after[0].recorded) {
    throw new Error(
      "[migrate] ✖ Verification failed: migration row missing from _prisma_migrations.",
    );
  }
  console.log("[migrate] ✔ Migration applied successfully. No existing data was deleted.");

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[migrate] ✖ Migration failed:", err);
  process.exitCode = 1;
});
