import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  traineeId: z.string(),
  checklistItemId: z.string(),
  completed: z.boolean(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const url = new URL(request.url);
  const traineeId = url.searchParams.get("traineeId");
  const positionId = url.searchParams.get("positionId");
  if (!traineeId || !positionId) {
    return errorResponse("traineeId and positionId are required");
  }

  const trainee = await prisma.trainee.findFirst({
    where: { id: traineeId, storeId: user.storeId },
  });
  if (!trainee) return errorResponse("Trainee not found", 404);

  const items = await prisma.checklistItem.findMany({
    where: { positionId },
    orderBy: { order: "asc" },
    include: {
      progress: {
        where: { traineeId },
        include: { completedBy: true },
      },
    },
  });

  return NextResponse.json({
    items: items.map((item) => {
      const progress = item.progress[0] ?? null;
      return {
        id: item.id,
        text: item.text,
        description: item.description,
        completed: progress?.completed ?? false,
        trainerName: progress?.trainerName ?? null,
        notes: progress?.notes ?? null,
        completedAt: progress?.completedAt ?? null,
      };
    }),
  });
}

export async function POST(request: Request) {
  const { user, error } = await requireAuth({ permission: "workflow.edit" });
  if (error) return error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return errorResponse("Invalid training progress payload");

  const trainee = await prisma.trainee.findFirst({
    where: { id: parsed.data.traineeId, storeId: user.storeId },
  });
  if (!trainee) return errorResponse("Trainee not found", 404);

  const item = await prisma.checklistItem.findUnique({
    where: { id: parsed.data.checklistItemId },
    include: { position: true },
  });
  if (!item || item.position.storeId !== user.storeId) {
    return errorResponse("Checklist item not found", 404);
  }

  const progress = await prisma.trainingProgress.upsert({
    where: {
      traineeId_checklistItemId: {
        traineeId: parsed.data.traineeId,
        checklistItemId: parsed.data.checklistItemId,
      },
    },
    update: {
      completed: parsed.data.completed,
      trainerName: parsed.data.completed ? user.name : null,
      notes: parsed.data.notes?.trim() || null,
      completedAt: parsed.data.completed ? new Date() : null,
      completedById: parsed.data.completed ? user.userId : null,
    },
    create: {
      traineeId: parsed.data.traineeId,
      checklistItemId: parsed.data.checklistItemId,
      completed: parsed.data.completed,
      trainerName: parsed.data.completed ? user.name : null,
      notes: parsed.data.notes?.trim() || null,
      completedAt: parsed.data.completed ? new Date() : null,
      completedById: parsed.data.completed ? user.userId : null,
    },
  });

  await logActivity({
    storeId: user.storeId,
    userId: user.userId,
    message: `${user.name} ${parsed.data.completed ? "completed" : "cleared"} item for ${trainee.name}`,
  });

  return NextResponse.json({ progress });
}
