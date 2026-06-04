import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import {
  activeProfileFromRequest,
  profileSchema,
  profileWhere,
  resolveWriteProfile,
} from "@/lib/profile";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2),
  /** ISO date string; if omitted, trainee start date is set to creation time (today). */
  startDate: z.string().optional(),
  positionIds: z.array(z.string()).default([]),
  profile: profileSchema.optional(),
});

export async function GET(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const positionId = url.searchParams.get("positionId") || "";

  const active = activeProfileFromRequest(request, user.activeProfile);

  const trainees = await prisma.trainee.findMany({
    where: {
      storeId: user.storeId,
      ...profileWhere(active),
      name: { contains: search, mode: "insensitive" },
      ...(positionId
        ? { positions: { some: { positionId } } }
        : {}),
    },
    include: {
      positions: { include: { position: true } },
      progress: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ trainees });
}

export async function POST(request: Request) {
  const { user, error } = await requireAuth({ permission: "trainees.create" });
  if (error) return error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid trainee payload" }, { status: 400 });
  }

  const profile = resolveWriteProfile(user.activeProfile, parsed.data.profile);
  if (!profile) {
    return errorResponse("Select FOH or BOH profile for this trainee", 400);
  }

  if (parsed.data.positionIds.length > 0) {
    const matching = await prisma.position.count({
      where: {
        storeId: user.storeId,
        profile,
        id: { in: parsed.data.positionIds },
      },
    });
    if (matching !== parsed.data.positionIds.length) {
      return errorResponse("All assigned positions must match the trainee profile", 400);
    }
  }

  const rawStart = parsed.data.startDate?.trim() ?? "";
  const startDate = rawStart.length > 0 ? new Date(rawStart) : new Date();

  const trainee = await prisma.trainee.create({
    data: {
      name: parsed.data.name.trim(),
      startDate,
      storeId: user.storeId,
      profile,
      positions: {
        createMany: {
          data: parsed.data.positionIds.map((id) => ({ positionId: id })),
          skipDuplicates: true,
        },
      },
    },
    include: {
      positions: { include: { position: true } },
    },
  });

  await logActivity({
    storeId: user.storeId,
    userId: user.userId,
    message: `Created trainee ${trainee.name}`,
  });

  return NextResponse.json({ trainee });
}
