/**
 * Read-only check: profiles migration applied and live data backfilled to FOH.
 * Run: npx tsx prisma/scripts/verify-profiles-migration.ts
 */
import { prisma } from "../../src/lib/prisma";

const MIGRATION_NAME = "20260604130000_add_profiles";

async function main() {
  const migration = await prisma.$queryRaw<
    { migration_name: string; finished_at: Date | null; applied_steps_count: number }[]
  >`
    SELECT migration_name, finished_at, applied_steps_count
    FROM "_prisma_migrations"
    WHERE migration_name = ${MIGRATION_NAME}
  `;

  const applied = migration.length > 0 && migration[0].finished_at != null;
  console.log("--- Migration record ---");
  if (migration.length === 0) {
    console.log(`NOT APPLIED: no row for ${MIGRATION_NAME}`);
  } else {
    console.log(JSON.stringify(migration[0], null, 2));
    console.log(applied ? "STATUS: APPLIED" : "STATUS: STARTED BUT NOT FINISHED");
  }

  const counts = await prisma.$queryRaw<
    {
      positions: bigint;
      trainees: bigint;
      task_rows: bigint;
      task_presets: bigint;
      task_week_archives: bigint;
      users: bigint;
      positions_non_foh: bigint;
      trainees_non_foh: bigint;
      users_missing_active: bigint;
    }[]
  >`
    SELECT
      (SELECT COUNT(*)::bigint FROM "Position") AS positions,
      (SELECT COUNT(*)::bigint FROM "Trainee") AS trainees,
      (SELECT COUNT(*)::bigint FROM "TaskRow") AS task_rows,
      (SELECT COUNT(*)::bigint FROM "TaskPreset") AS task_presets,
      (SELECT COUNT(*)::bigint FROM "TaskWeekArchive") AS task_week_archives,
      (SELECT COUNT(*)::bigint FROM "User") AS users,
      (SELECT COUNT(*)::bigint FROM "Position" WHERE profile::text != 'FOH') AS positions_non_foh,
      (SELECT COUNT(*)::bigint FROM "Trainee" WHERE profile::text != 'FOH') AS trainees_non_foh,
      (SELECT COUNT(*)::bigint FROM "User" WHERE "activeProfile" IS NULL OR "activeProfile" = '') AS users_missing_active
  `;

  const c = counts[0];
  console.log("\n--- Row counts (data preserved) ---");
  console.log({
    positions: Number(c.positions),
    trainees: Number(c.trainees),
    task_rows: Number(c.task_rows),
    task_presets: Number(c.task_presets),
    task_week_archives: Number(c.task_week_archives),
    users: Number(c.users),
  });
  console.log("\n--- Profile backfill check ---");
  console.log({
    positions_not_FOH: Number(c.positions_non_foh),
    trainees_not_FOH: Number(c.trainees_non_foh),
    users_missing_activeProfile: Number(c.users_missing_active),
  });

  if (!applied) {
    console.log("\n>>> Run: npx prisma migrate deploy");
    process.exitCode = 1;
    return;
  }

  const bad =
    Number(c.users_missing_active) > 0;
  if (bad) {
    console.log("\n>>> WARNING: some users lack activeProfile");
    process.exitCode = 1;
  } else {
    console.log("\n>>> OK: migration applied; existing rows default to FOH unless you added BOH data.");
  }
}

main()
  .catch((e) => {
    const msg = String(e);
    if (msg.includes("profile") && msg.includes("does not exist")) {
      console.error("\n>>> Columns not in DB yet — migration NOT applied. Safe to run:");
      console.error("    npx prisma migrate deploy");
      process.exitCode = 1;
    } else {
      console.error(e);
      process.exitCode = 1;
    }
  })
  .finally(() => prisma.$disconnect());
