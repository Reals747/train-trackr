import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

let warnedMissingWorkflowComments = false;

/** True when this generated client includes the workflow comments model. */
function hasWorkflowGeneralComments(client: PrismaClient): boolean {
  return (
    typeof (client as { workflowGeneralComments?: { findFirst?: unknown } }).workflowGeneralComments
      ?.findFirst === "function"
  );
}

/** True when this generated client includes the TaskCell model. */
function hasTaskCell(client: PrismaClient): boolean {
  return (
    typeof (client as { taskCell?: { findMany?: unknown } }).taskCell?.findMany === "function"
  );
}

/** True when this generated client includes the TaskRow model (added in the grid rows migration). */
function hasTaskRow(client: PrismaClient): boolean {
  return (
    typeof (client as { taskRow?: { findMany?: unknown } }).taskRow?.findMany === "function"
  );
}

/** True when this generated client includes schedule break completion persistence. */
function hasScheduleBreakCompletion(client: PrismaClient): boolean {
  return (
    typeof (client as { scheduleBreakCompletion?: { findMany?: unknown } }).scheduleBreakCompletion
      ?.findMany === "function"
  );
}

function createClient() {
  return new PrismaClient({
    log: ["error"],
  });
}

/**
 * Reuse one PrismaClient per runtime. If a cached client predates `prisma generate` (common after
 * adding a model while `next dev` is running), it may omit `workflowGeneralComments`; we replace it.
 */
function getPrisma(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && hasWorkflowGeneralComments(cached) && hasTaskRow(cached)) {
    return cached;
  }
  if (cached) {
    void cached.$disconnect().catch(() => {});
  }
  const next = createClient();
  if (!hasWorkflowGeneralComments(next) && !warnedMissingWorkflowComments) {
    warnedMissingWorkflowComments = true;
    console.error(
      "[prisma] Client is missing workflowGeneralComments (stale generate or dev server). Run: npx prisma generate — then restart next dev.",
    );
  }
  globalForPrisma.prisma = next;
  return next;
}

export const prisma = getPrisma();

/** Used by API routes to fail fast with a clear message instead of `undefined.findFirst`. */
export function prismaHasWorkflowGeneralComments(): boolean {
  return hasWorkflowGeneralComments(prisma);
}

/** Used by the tasks API route to fail fast with a clear message instead of `undefined.findMany`. */
export function prismaHasTaskCell(): boolean {
  return hasTaskCell(prisma);
}

/** Used by the tasks API routes to detect a stale client missing the rows/presets/archive models. */
export function prismaHasTaskRow(): boolean {
  return hasTaskRow(prisma);
}

/** Used by schedule break routes after the schedule break completions migration. */
export function prismaHasScheduleBreakCompletion(): boolean {
  return hasScheduleBreakCompletion(prisma);
}
