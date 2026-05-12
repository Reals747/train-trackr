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
  if (cached && hasWorkflowGeneralComments(cached)) {
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
