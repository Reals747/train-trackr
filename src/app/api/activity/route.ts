import { ACTIVITY_LOG_LIMIT } from "@/lib/activity";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const { user, error } = await requireAuth({ permission: "activity.view" });
  if (error) return error;

  const logs = await prisma.activityLog.findMany({
    where: { storeId: user.storeId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: ACTIVITY_LOG_LIMIT,
  });
  return NextResponse.json({
    logs: logs.map((log) => ({
      id: log.id,
      message: log.message,
      createdAt: log.createdAt,
      actor: log.user?.name ?? "System",
    })),
  });
}
