import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const patchSchema = z
  .object({
    role: z.enum(["ADMIN", "TRAINER"]).optional(),
    name: z.string().trim().min(1).max(100).optional(),
  })
  .refine((value) => value.role !== undefined || value.name !== undefined, {
    message: "Provide a role or a name to update",
  });

/**
 * Update a single team member.
 *
 * - Role changes still require `members.updateRole` and can't target self/owner.
 * - Name changes are allowed when the caller is the same user OR when the
 *   caller is an admin/owner whose role permits managing members. Admins
 *   cannot rename the store owner — only the owner themselves can.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ trainerId: string }> },
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { trainerId } = await params;

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Invalid payload");
  }

  const target = await prisma.user.findFirst({
    where: {
      id: trainerId,
      storeId: user.storeId,
      role: {
        in: [Role.WEBSITE_DEVELOPER, Role.OWNER, Role.ADMIN, Role.TRAINER],
      },
    },
  });
  if (!target) return errorResponse("User not found", 404);

  const isSelf = trainerId === user.userId;
  const updateData: { role?: Role; name?: string } = {};

  // --- Role change checks -----------------------------------------------
  if (parsed.data.role !== undefined) {
    if (!can(user.role, "members.updateRole")) {
      return errorResponse("Forbidden", 403);
    }
    if (isSelf) {
      return errorResponse("You cannot change your own role here.", 400);
    }
    if (target.role === Role.OWNER) {
      return errorResponse("The store owner cannot be reassigned.", 400);
    }
    /** The website developer account is intentionally undemotable. */
    if (target.role === Role.WEBSITE_DEVELOPER) {
      return errorResponse("The website developer cannot be reassigned.", 400);
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
    updateData.role = parsed.data.role;
  }

  // --- Name change checks -----------------------------------------------
  if (parsed.data.name !== undefined) {
    if (!isSelf) {
      // Only managers can rename other people; the owner and website
      // developer are additionally protected from non-peer renames.
      if (!can(user.role, "members.updateRole")) {
        return errorResponse("Forbidden", 403);
      }
      if (target.role === Role.OWNER && user.role !== Role.OWNER && user.role !== Role.WEBSITE_DEVELOPER) {
        return errorResponse("Only the store owner can change the owner's name.", 403);
      }
      if (target.role === Role.WEBSITE_DEVELOPER && user.role !== Role.WEBSITE_DEVELOPER) {
        return errorResponse("Only the website developer can change that name.", 403);
      }
    }
    updateData.name = parsed.data.name;
  }

  const updated = await prisma.user.update({
    where: { id: trainerId },
    data: updateData,
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      createdAt: true,
      trainerInviteCodeUsed: true,
      passwordHash: true,
    },
  });

  return NextResponse.json({
    member: {
      id: updated.id,
      name: updated.name,
      username: updated.username,
      role: updated.role,
      createdAt: updated.createdAt.toISOString(),
      trainerInviteCodeUsed: updated.trainerInviteCodeUsed,
      hasPassword: Boolean(updated.passwordHash),
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
      role: {
        in: [Role.WEBSITE_DEVELOPER, Role.OWNER, Role.ADMIN, Role.TRAINER],
      },
    },
  });
  if (!target) {
    return errorResponse("User not found", 404);
  }

  if (target.role === Role.OWNER) {
    return errorResponse("The store owner cannot be removed.", 400);
  }
  if (target.role === Role.WEBSITE_DEVELOPER) {
    return errorResponse("The website developer cannot be removed.", 400);
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
