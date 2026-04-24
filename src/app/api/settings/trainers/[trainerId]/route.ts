import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  role: z.enum(["ADMIN", "TRAINER"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ trainerId: string }> },
) {
  const { user, error } = await requireAuth({ permission: "members.updateRole" });
  if (error) return error;

  const { trainerId } = await params;
  if (trainerId === user.userId) {
    return errorResponse("You cannot change your own role here.", 400);
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return errorResponse("Invalid role");

  const target = await prisma.user.findFirst({
    where: {
      id: trainerId,
      storeId: user.storeId,
      role: { in: [Role.OWNER, Role.ADMIN, Role.TRAINER] },
    },
  });
  if (!target) return errorResponse("User not found", 404);

  if (target.role === Role.OWNER) {
    return errorResponse("The store owner cannot be reassigned.", 400);
  }

  if (target.role === Role.ADMIN && parsed.data.role === Role.TRAINER) {
    const adminCount = await prisma.user.count({
      where: { storeId: user.storeId, role: Role.ADMIN },
    });
    const ownerCount = await prisma.user.count({
      where: { storeId: user.storeId, role: Role.OWNER },
    });
    if (adminCount <= 1 && ownerCount < 1) {
      return errorResponse("Cannot demote the only admin for this store.", 400);
    }
  }

  const updated = await prisma.user.update({
    where: { id: trainerId },
    data: { role: parsed.data.role },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      createdAt: true,
      trainerInviteCodeUsed: true,
    },
  });

  return NextResponse.json({
    member: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ trainerId: string }> },
) {
  const { user, error } = await requireAuth({ permission: "members.remove" });
  if (error) return error;

  const { trainerId } = await params;
  if (trainerId === user.userId) {
    return errorResponse("You cannot remove your own account here.", 400);
  }

  const target = await prisma.user.findFirst({
    where: {
      id: trainerId,
      storeId: user.storeId,
      role: { in: [Role.OWNER, Role.ADMIN, Role.TRAINER] },
    },
  });
  if (!target) {
    return errorResponse("User not found", 404);
  }

  if (target.role === Role.OWNER) {
    return errorResponse("The store owner cannot be removed.", 400);
  }

  if (target.role === Role.ADMIN) {
    const adminCount = await prisma.user.count({
      where: { storeId: user.storeId, role: Role.ADMIN },
    });
    const ownerCount = await prisma.user.count({
      where: { storeId: user.storeId, role: Role.OWNER },
    });
    if (adminCount <= 1 && ownerCount < 1) {
      return errorResponse("Cannot remove the only admin for this store.", 400);
    }
  }

  await prisma.user.delete({ where: { id: trainerId } });
  return NextResponse.json({ success: true });
}
