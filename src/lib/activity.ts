import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ACTIVITY_LOG_LIMIT = 20;

/** Activity feed shows `message` plus actor name separately — never repeat the actor in the message. */
export async function logActivity(input: {
  storeId: string;
  userId?: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.activityLog.create({
      data: {
        storeId: input.storeId,
        userId: input.userId,
        message: input.message,
        metadata: input.metadata,
      },
    });

    const stale = await tx.activityLog.findMany({
      where: { storeId: input.storeId },
      orderBy: { createdAt: "desc" },
      skip: ACTIVITY_LOG_LIMIT,
      select: { id: true },
    });
    if (stale.length > 0) {
      await tx.activityLog.deleteMany({
        where: { id: { in: stale.map((row) => row.id) } },
      });
    }
  });
}
