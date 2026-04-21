import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2),
  startDate: z.string().min(1),
  positionIds: z.array(z.string()).default([]),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ traineeId: string }> },
) {
  const { user, error } = await requireAuth({ permission: "trainees.update" });
  if (error) return error;
  const { traineeId } = await params;

  const trainee = await prisma.trainee.findFirst({
    where: { id: traineeId, storeId: user.storeId },
  });
  if (!trainee) return errorResponse("Trainee not found", 404);

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return errorResponse("Invalid trainee payload");

  const updated = await prisma.$transaction(async (tx) => {
    await tx.trainee.update({
      where: { id: traineeId },
      data: {
        name: parsed.data.name.trim(),
        startDate: new Date(parsed.data.startDate),
      },
      include: { positions: { include: { position: true } } },
    });
    await tx.traineePosition.deleteMany({ where: { traineeId } });
    await tx.traineePosition.createMany({
      data: parsed.data.positionIds.map((positionId) => ({ traineeId, positionId })),
      skipDuplicates: true,
    });
    return tx.trainee.findUniqueOrThrow({
      where: { id: traineeId },
      include: { positions: { include: { position: true } } },
    });
  });

  return NextResponse.json({ trainee: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ traineeId: string }> },
) {
  const { user, error } = await requireAuth({ permission: "trainees.delete" });
  if (error) return error;
  const { traineeId } = await params;

  const trainee = await prisma.trainee.findFirst({
    where: { id: traineeId, storeId: user.storeId },
  });
  if (!trainee) return errorResponse("Trainee not found", 404);

  await prisma.trainee.delete({ where: { id: traineeId } });
  return NextResponse.json({ success: true });
}
