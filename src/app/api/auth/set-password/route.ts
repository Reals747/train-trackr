import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, setAuthCookie, signToken } from "@/lib/auth";
import { jsonAuthRouteError } from "@/lib/auth-route-error-response";
import { prisma } from "@/lib/prisma";
import { STORE_CODE_REGEX } from "@/lib/store-code";

/**
 * "Help, I don't have a password!" recovery flow.
 *
 * Use case: a trainer was promoted to ADMIN. Trainer accounts are created
 * without a password (the store code stands in), so the new admin can't
 * sign in via the regular owner/admin form because that form expects a
 * password.
 *
 * This endpoint lets them set their FIRST password. To prevent abuse by
 * anyone who happens to hold the store code, we ONLY accept the request
 * when the user currently has `passwordHash IS NULL`. If a real password
 * has already been set, the request is rejected (the user must use the
 * normal login flow or reset via an admin).
 *
 * Successfully setting a password also signs the user in, so they're
 * dropped straight into the app.
 */
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
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const ELIGIBLE_ROLES: Role[] = [Role.OWNER, Role.ADMIN, Role.WEBSITE_DEVELOPER];

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
        { status: 400 },
      );
    }

    const { storeCode, username, password } = parsed.data;
    const loginKey = username.toLowerCase();

    const store = await prisma.store.findUnique({
      where: { storeCode },
      select: { id: true, name: true, storeCode: true },
    });
    if (!store) {
      return NextResponse.json({ error: "Unknown store code" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { storeId_username: { storeId: store.id, username: loginKey } },
      include: { store: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "No account with that username in this store" },
        { status: 404 },
      );
    }

    /**
     * Only manager-level accounts use the password sign-in form, so trainers
     * shouldn't end up here. We block trainers explicitly to keep the surface
     * tiny and predictable: trainers continue to sign in with username +
     * store code via the existing /api/auth/login trainer mode.
     */
    if (!ELIGIBLE_ROLES.includes(user.role)) {
      return NextResponse.json(
        {
          error:
            "This account doesn't need a password — sign in on the 'Invited Code' tab.",
        },
        { status: 400 },
      );
    }

    /**
     * Refuse to overwrite an existing password. If the user has one, they
     * must remember it (or have an owner reset their account out-of-band).
     * This prevents anyone-with-the-store-code from impersonating an admin.
     */
    if (user.passwordHash) {
      return NextResponse.json(
        {
          error:
            "An account password is already set. Sign in with that password instead.",
        },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
      include: { store: true },
    });

    const token = signToken({
      userId: updated.id,
      username: updated.username,
      role: updated.role,
      storeId: updated.storeId,
      name: updated.name,
    });
    await setAuthCookie(token);

    return NextResponse.json({
      user: {
        id: updated.id,
        username: updated.username,
        role: updated.role,
        name: updated.name,
        storeId: updated.storeId,
        storeName: updated.store.name,
        storeCode: updated.store.storeCode,
      },
    });
  } catch (error) {
    return jsonAuthRouteError(error);
  }
}
