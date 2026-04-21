import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, setAuthCookie, signToken } from "@/lib/auth";
import { jsonAuthRouteError } from "@/lib/auth-route-error-response";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  storeName: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { storeName, name, email, password } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const { store, user } = await prisma.$transaction(async (tx) => {
      const createdStore = await tx.store.create({
        data: { name: storeName, settings: { create: {} } },
      });
      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: Role.OWNER,
          storeId: createdStore.id,
        },
      });
      return { store: createdStore, user: createdUser };
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      storeId: store.id,
      name: user.name,
    });
    await setAuthCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        storeId: store.id,
        storeName: store.name,
      },
    });
  } catch (error) {
    return jsonAuthRouteError(error);
  }
}
