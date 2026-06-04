import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { profileSchema } from "@/lib/profile";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2).optional(),
  profile: profileSchema.optional(),
}).refine((v) => v.name !== undefined || v.profile !== undefined, {
  message: "At least one field must be provided",
});

const patchSchema = z.object({
  hidden: z.boolean(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ positionId: string }> },
) {
  const { user, error } = await requireAuth({ permission: "positions.manage" });
  if (error) return error;
  const { positionId } = await params;

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return errorResponse("Invalid payload");

  const current = await prisma.position.findFirst({
    where: { id: positionId, storeId: user.storeId },
  });
  if (!current) return errorResponse("Position not found", 404);

  const updated = await prisma.position.update({
    where: { id: positionId },
    data: { hidden: parsed.data.hidden },
  });
  await logActivity({
    storeId: user.storeId,
    userId: user.userId,
    message: parsed.data.hidden
      ? `Hidden position ${current.name}`
      : `Restored position ${current.name}`,
  });

  return NextResponse.json({ position: updated });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ positionId: string }> },
) {
  const { user, error } = await requireAuth({ permission: "positions.manage" });
  if (error) return error;
  const { positionId } = await params;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return errorResponse("Invalid position payload");

  const current = await prisma.position.findFirst({
    where: { id: positionId, storeId: user.storeId },
  });
  if (!current) return errorResponse("Position not found", 404);

  const nextProfile = parsed.data.profile ?? current.profile;
  const nextName = parsed.data.name?.trim() ?? current.name;

  const updated = await prisma.$transaction(async (tx) => {
    const pos = await tx.position.update({
      where: { id: positionId },
      data: {
        ...(parsed.data.name !== undefined ? { name: nextName } : {}),
        ...(parsed.data.profile !== undefined ? { profile: nextProfile } : {}),
      },
    });
    if (parsed.data.profile !== undefined && nextProfile !== current.profile) {
      await tx.traineePosition.deleteMany({
        where: {
          positionId,
          trainee: { profile: { not: nextProfile } },
        },
      });
    }
    return pos;
  });

  await logActivity({
    storeId: user.storeId,
    userId: user.userId,
    message:
      parsed.data.profile !== undefined && nextProfile !== current.profile
        ? `Moved position ${current.name} to ${nextProfile}`
        : `Renamed position ${current.name} to ${updated.name}`,
  });

  return NextResponse.json({ position: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ positionId: string }> },
) {
  const { user, error } = await requireAuth({ permission: "positions.manage" });
  if (error) return error;
  const { positionId } = await params;

  const current = await prisma.position.findFirst({
    where: { id: positionId, storeId: user.storeId },
  });
  if (!current) return errorResponse("Position not found", 404);

  await prisma.position.delete({ where: { id: positionId } });
  await logActivity({
    storeId: user.storeId,
    userId: user.userId,
    message: `Deleted position ${current.name}`,
  });
  return NextResponse.json({ success: true });
}
