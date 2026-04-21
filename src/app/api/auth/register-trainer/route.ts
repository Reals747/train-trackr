import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, setAuthCookie, signToken } from "@/lib/auth";
import { jsonAuthRouteError } from "@/lib/auth-route-error-response";
import { prisma } from "@/lib/prisma";

const usernameSchema = z
  .string()
  .trim()
  .min(2, "Username must be at least 2 characters")
  .max(64)
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    "Username: letters, numbers, dots, dashes, and underscores only",
  );

const schema = z.object({
  inviteCode: z.string().regex(/^\d{6}$/),
  name: z.string().min(2),
  username: usernameSchema,
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid registration details" }, { status: 400 });
    }

    const { inviteCode, name, username, password } = parsed.data;
    const loginKey = username.toLowerCase();
    const existing = await prisma.user.findFirst({
      where: { email: { equals: loginKey, mode: "insensitive" } },
    });
    if (existing) {
      return NextResponse.json({ error: "Username already in use" }, { status: 409 });
    }

    const settings = await prisma.storeSetting.findFirst({
      where: { trainerInviteCode: inviteCode },
      include: { store: true },
    });
    if (!settings) {
      return NextResponse.json({ error: "Invalid or expired invite code" }, { status: 400 });
    }

    const now = new Date();
    if (!settings.trainerInviteExpiresAt || settings.trainerInviteExpiresAt <= now) {
      await prisma.storeSetting.updateMany({
        where: { storeId: settings.storeId, trainerInviteCode: inviteCode },
        data: { trainerInviteCode: null, trainerInviteExpiresAt: null },
      });
      return NextResponse.json({ error: "Invite code expired. Ask your admin for a new code." }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const userRow = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: name.trim(),
          email: loginKey,
          passwordHash,
          role: Role.TRAINER,
          storeId: settings.storeId,
          trainerInviteCodeUsed: inviteCode,
        },
      });

      await tx.storeSetting.update({
        where: { storeId: settings.storeId },
        data: {
          trainerInviteCode: null,
          trainerInviteExpiresAt: null,
        },
      });

      return created;
    });

    const token = signToken({
      userId: userRow.id,
      email: userRow.email,
      role: userRow.role,
      storeId: userRow.storeId,
      name: userRow.name,
    });
    await setAuthCookie(token);

    return NextResponse.json({
      user: {
        id: userRow.id,
        email: userRow.email,
        role: userRow.role,
        name: userRow.name,
        storeId: userRow.storeId,
        storeName: settings.store.name,
      },
    });
  } catch (error) {
    return jsonAuthRouteError(error);
  }
}
