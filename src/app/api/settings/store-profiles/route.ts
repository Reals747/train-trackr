import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { isProfileColor, serializeStoreProfile } from "@/lib/store-profiles";
import {
  generateUniqueProfileKey,
  listStoreProfiles,
} from "@/lib/store-profiles-server";

const createSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().trim(),
});

export async function GET() {
  const { user, error } = await requireAuth({ permission: "settings.store.profiles" });
  if (error) return error;

  const profiles = await listStoreProfiles(user.storeId);
  return NextResponse.json({ profiles });
}

export async function POST(request: Request) {
  const { user, error } = await requireAuth({ permission: "settings.store.profiles" });
  if (error) return error;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Invalid profile");
  }

  const color = isProfileColor(parsed.data.color) ? parsed.data.color : "green";
  const key = await generateUniqueProfileKey(user.storeId, parsed.data.name);
  const maxOrder = await prisma.storeProfile.aggregate({
    where: { storeId: user.storeId },
    _max: { sortOrder: true },
  });

  const created = await prisma.storeProfile.create({
    data: {
      storeId: user.storeId,
      key,
      name: parsed.data.name.trim(),
      color,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  await logActivity({
    storeId: user.storeId,
    userId: user.userId,
    message: `Created profile "${created.name}"`,
  });

  return NextResponse.json({ profile: serializeStoreProfile(created) });
}
