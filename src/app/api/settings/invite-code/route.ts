import { addDays } from "date-fns";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const INVITE_VALID_DAYS = 7;

function randomSixDigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function generateUniqueInviteCode() {
  for (let i = 0; i < 20; i += 1) {
    const code = randomSixDigitCode();
    const existing = await prisma.storeSetting.findFirst({
      where: { trainerInviteCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error("Unable to generate unique invite code");
}

/** Clear code if past expiry (7 days) or legacy row with no expiry. */
async function clearInviteIfExpired(storeId: string) {
  const row = await prisma.storeSetting.findUnique({
    where: { storeId },
    select: { trainerInviteCode: true, trainerInviteExpiresAt: true },
  });
  if (!row?.trainerInviteCode) return;
  const now = new Date();
  const legacyNoExpiry = !row.trainerInviteExpiresAt;
  const expired = row.trainerInviteExpiresAt && row.trainerInviteExpiresAt <= now;
  if (legacyNoExpiry || expired) {
    await prisma.storeSetting.update({
      where: { storeId },
      data: { trainerInviteCode: null, trainerInviteExpiresAt: null },
    });
  }
}

export async function GET() {
  const { user, error } = await requireAuth({ permission: "members.invite" });
  if (error) return error;

  await clearInviteIfExpired(user.storeId);

  const settings = await prisma.storeSetting.findUnique({
    where: { storeId: user.storeId },
    select: { trainerInviteCode: true, trainerInviteExpiresAt: true },
  });

  if (!settings?.trainerInviteCode) {
    return NextResponse.json({ inviteCode: null, expiresAt: null });
  }

  return NextResponse.json({
    inviteCode: settings.trainerInviteCode,
    expiresAt: settings.trainerInviteExpiresAt?.toISOString() ?? null,
  });
}

export async function POST() {
  const { user, error } = await requireAuth({ permission: "members.invite" });
  if (error) return error;

  try {
    const code = await generateUniqueInviteCode();
    const expiresAt = addDays(new Date(), INVITE_VALID_DAYS);
    const settings = await prisma.storeSetting.upsert({
      where: { storeId: user.storeId },
      create: {
        storeId: user.storeId,
        trainerInviteCode: code,
        trainerInviteExpiresAt: expiresAt,
      },
      update: {
        trainerInviteCode: code,
        trainerInviteExpiresAt: expiresAt,
      },
      select: { trainerInviteCode: true, trainerInviteExpiresAt: true },
    });

    return NextResponse.json({
      inviteCode: settings.trainerInviteCode,
      expiresAt: settings.trainerInviteExpiresAt?.toISOString() ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate invite code" }, { status: 500 });
  }
}
