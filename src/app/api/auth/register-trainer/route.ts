import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { setAuthCookie, signToken } from "@/lib/auth";
import { jsonAuthRouteError } from "@/lib/auth-route-error-response";
import { prisma } from "@/lib/prisma";
import { STORE_CODE_REGEX } from "@/lib/store-code";

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
  storeCode: z.string().regex(STORE_CODE_REGEX, "Store code must be 8 digits"),
  username: usernameSchema,
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid registration details" }, { status: 400 });
    }

    const { storeCode, username } = parsed.data;
    const loginKey = username.toLowerCase();

    const store = await prisma.store.findUnique({
      where: { storeCode },
      select: { id: true, name: true },
    });
    if (!store) {
      return NextResponse.json({ error: "Unknown store code" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { storeId_username: { storeId: store.id, username: loginKey } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "That username is already taken in this store" },
        { status: 409 },
      );
    }

    const userRow = await prisma.user.create({
      data: {
        name: loginKey,
        username: loginKey,
        role: Role.TRAINER,
        storeId: store.id,
        trainerInviteCodeUsed: storeCode,
      },
    });

    const token = signToken({
      userId: userRow.id,
      username: userRow.username,
      role: userRow.role,
      storeId: userRow.storeId,
      name: userRow.name,
    });
    await setAuthCookie(token);

    return NextResponse.json({
      user: {
        id: userRow.id,
        username: userRow.username,
        role: userRow.role,
        name: userRow.name,
        storeId: userRow.storeId,
        storeName: store.name,
        storeCode,
      },
    });
  } catch (error) {
    return jsonAuthRouteError(error);
  }
}
