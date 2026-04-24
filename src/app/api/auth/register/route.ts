import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, setAuthCookie, signToken } from "@/lib/auth";
import { jsonAuthRouteError } from "@/lib/auth-route-error-response";
import { prisma } from "@/lib/prisma";
import { generateUniqueStoreCode } from "@/lib/store-code";

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
  storeName: z.string().trim().min(2),
  name: z.string().trim().min(2),
  username: usernameSchema,
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { storeName, name, username, password } = parsed.data;
    const loginKey = username.toLowerCase();
    const passwordHash = await hashPassword(password);
    const storeCode = await generateUniqueStoreCode();

    const { store, user } = await prisma.$transaction(async (tx) => {
      const createdStore = await tx.store.create({
        data: {
          name: storeName,
          storeCode,
          settings: { create: {} },
        },
      });
      const createdUser = await tx.user.create({
        data: {
          name: name.trim(),
          username: loginKey,
          passwordHash,
          role: Role.OWNER,
          storeId: createdStore.id,
        },
      });
      return { store: createdStore, user: createdUser };
    });

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      storeId: store.id,
      name: user.name,
    });
    await setAuthCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        storeId: store.id,
        storeName: store.name,
        storeCode: store.storeCode,
      },
    });
  } catch (error) {
    return jsonAuthRouteError(error);
  }
}
