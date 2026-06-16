import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { activeProfileSchema, normalizeActiveProfile } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { STORE_CODE_REGEX } from "@/lib/store-code";
import { listStoreProfiles } from "@/lib/store-profiles-server";

const updateActiveProfileSchema = z.object({
  activeProfile: activeProfileSchema,
  storeCode: z.string().regex(STORE_CODE_REGEX, "Store code must be 8 digits").optional(),
});

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const profiles = await listStoreProfiles(user.storeId);
  const profileKeys = profiles.map((profile) => profile.key);

  const row = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { activeProfile: true },
  });

  return NextResponse.json({
    activeProfile: normalizeActiveProfile(row?.activeProfile, profileKeys),
  });
}

export async function PUT(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const profiles = await listStoreProfiles(user.storeId);
  const profileKeys = profiles.map((profile) => profile.key);

  const raw = await request.json().catch(() => null);
  const parsed = updateActiveProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse("Invalid profile selection.");
  }
  if (!profileKeys.includes(parsed.data.activeProfile)) {
    return errorResponse("Invalid profile selection.");
  }

  if (user.role === Role.TRAINER) {
    const storeCode = parsed.data.storeCode;
    if (!storeCode) {
      return errorResponse("Store code is required to switch profiles.", 400);
    }
    const store = await prisma.store.findUnique({
      where: { id: user.storeId },
      select: { storeCode: true },
    });
    if (!store || store.storeCode !== storeCode) {
      return errorResponse("The store code you entered does not match.", 400);
    }
  }

  await prisma.user.update({
    where: { id: user.userId },
    data: { activeProfile: parsed.data.activeProfile },
  });

  return NextResponse.json({ activeProfile: parsed.data.activeProfile });
}
