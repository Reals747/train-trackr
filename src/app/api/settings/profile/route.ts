import { NextResponse } from "next/server";
import { errorResponse, requireAuth } from "@/lib/api";
import { activeProfileSchema, normalizeActiveProfile } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { listStoreProfiles } from "@/lib/store-profiles-server";

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
  const parsed = activeProfileSchema.safeParse(
    raw && typeof raw === "object" && "activeProfile" in raw
      ? (raw as { activeProfile: unknown }).activeProfile
      : raw,
  );
  if (!parsed.success) {
    return errorResponse("Invalid profile selection.");
  }
  if (!profileKeys.includes(parsed.data)) {
    return errorResponse("Invalid profile selection.");
  }

  await prisma.user.update({
    where: { id: user.userId },
    data: { activeProfile: parsed.data },
  });

  return NextResponse.json({ activeProfile: parsed.data });
}
