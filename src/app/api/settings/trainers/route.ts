import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const { user, error } = await requireAuth({ permission: "members.view" });
  if (error) return error;

  const members = await prisma.user.findMany({
    where: {
      storeId: user.storeId,
      role: {
        in: [Role.WEBSITE_DEVELOPER, Role.OWNER, Role.ADMIN, Role.TRAINER],
      },
    },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      createdAt: true,
      trainerInviteCodeUsed: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      username: m.username,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
      trainerInviteCodeUsed: m.trainerInviteCodeUsed,
    })),
  });
}
