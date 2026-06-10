import { NextResponse } from "next/server";
import { errorResponse, requireAuth } from "@/lib/api";
import { activeProfileSchema } from "@/lib/profile";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const row = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { activeProfile: true },
  });

  const parsed = activeProfileSchema.safeParse(row?.activeProfile);
  return NextResponse.json({
    activeProfile: parsed.success ? parsed.data : "FOH",
  });
}

export async function PUT(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const raw = await request.json().catch(() => null);
  const parsed = activeProfileSchema.safeParse(
    raw && typeof raw === "object" && "activeProfile" in raw
      ? (raw as { activeProfile: unknown }).activeProfile
      : raw,
  );
  if (!parsed.success) {
    return errorResponse("Invalid profile. Use FOH or BOH.");
  }

  await prisma.user.update({
    where: { id: user.userId },
    data: { activeProfile: parsed.data },
  });

  return NextResponse.json({ activeProfile: parsed.data });
}
