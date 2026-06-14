import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { apiProfileField, profileSchema } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { assertStoreProfileKey, profileWriteData } from "@/lib/store-profiles-server";

const schema = z
  .object({
    name: z.string().min(2).optional(),
    startDate: z.string().min(1).optional(),
    positionIds: z.array(z.string()).optional(),
    profile: profileSchema.optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: "At least one field must be provided",
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

  const nextProfileKey = parsed.data.profile ?? apiProfileField(trainee);
  const effectiveProfileKey = parsed.data.profile
    ? await assertStoreProfileKey(user.storeId, nextProfileKey)
    : apiProfileField(trainee);
  if (parsed.data.profile && !effectiveProfileKey) {
    return errorResponse("Select a valid profile for this trainee", 400);
  }

  if (parsed.data.positionIds !== undefined && parsed.data.positionIds.length > 0) {
    const matching = await prisma.position.count({
      where: {
        storeId: user.storeId,
        profileKey: effectiveProfileKey!,
        id: { in: parsed.data.positionIds },
      },
    });
    if (matching !== parsed.data.positionIds.length) {
      return errorResponse("All assigned positions must match the trainee profile", 400);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const data: { name?: string; startDate?: Date; profileKey?: string; profile?: "FOH" | "BOH" } = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
    if (parsed.data.startDate !== undefined) data.startDate = new Date(parsed.data.startDate);
    if (parsed.data.profile !== undefined && effectiveProfileKey) {
      Object.assign(data, profileWriteData(effectiveProfileKey));
    }
    if (Object.keys(data).length > 0) {
      await tx.trainee.update({ where: { id: traineeId }, data });
    }
    if (
      parsed.data.profile !== undefined &&
      effectiveProfileKey &&
      effectiveProfileKey !== apiProfileField(trainee)
    ) {
      await tx.traineePosition.deleteMany({
        where: {
          traineeId,
          position: { profileKey: { not: effectiveProfileKey } },
        },
      });
    }
    if (parsed.data.positionIds !== undefined) {
      await tx.traineePosition.deleteMany({ where: { traineeId } });
      await tx.traineePosition.createMany({
        data: parsed.data.positionIds.map((positionId) => ({ traineeId, positionId })),
        skipDuplicates: true,
      });
    }
    return tx.trainee.findUniqueOrThrow({
      where: { id: traineeId },
      include: { positions: { include: { position: true } } },
    });
  });

  await logActivity({
    storeId: user.storeId,
    userId: user.userId,
    message: `Updated trainee "${updated.name}"`,
  });

  return NextResponse.json({
    trainee: { ...updated, profile: apiProfileField(updated) },
  });
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
  await logActivity({
    storeId: user.storeId,
    userId: user.userId,
    message: `Deleted trainee "${trainee.name}"`,
  });
  return NextResponse.json({ success: true });
}
