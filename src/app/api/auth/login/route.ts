import { NextResponse } from "next/server";
import { z } from "zod";
import { comparePassword, setAuthCookie, signToken } from "@/lib/auth";
import { jsonAuthRouteError } from "@/lib/auth-route-error-response";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  /** Email (owners) or username stored in `User.email` (other roles). */
  identifier: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid credentials format" }, { status: 400 });
    }

    const identifier = parsed.data.identifier.trim();
    const user = await prisma.user.findFirst({
      where: { email: { equals: identifier, mode: "insensitive" } },
      include: { store: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Invalid sign-in or password" }, { status: 401 });
    }

    const isValid = await comparePassword(parsed.data.password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid sign-in or password" }, { status: 401 });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      storeId: user.storeId,
      name: user.name,
    });
    await setAuthCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        storeId: user.storeId,
        storeName: user.store.name,
      },
    });
  } catch (error) {
    return jsonAuthRouteError(error);
  }
}
