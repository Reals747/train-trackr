import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function logActivity(input: {
  storeId: string;
  userId?: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.activityLog.create({
    data: {
      storeId: input.storeId,
      userId: input.userId,
      message: input.message,
      metadata: input.metadata,
    },
  });
}
