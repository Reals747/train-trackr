import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, setAuthCookie, signToken } from "@/lib/auth";
import { jsonAuthRouteError } from "@/lib/auth-route-error-response";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { normalizeActiveProfile } from "@/lib/profile";
import { STORE_CODE_REGEX } from "@/lib/store-code";

/**
 * Self-service password set/reset for logged-out manager accounts (owner, admin,
 * website developer).
 *
 * Use cases:
 *   - A trainer was promoted to admin and never set a password.
 *   - A manager forgot their password.
 *
 * Recovery is gated by the 8-digit store code plus username. Trainers must
 * continue using the "Invited Code" sign-in tab (no password).
 *
 * Successfully setting a password also signs the user in.
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
     * Overwrite any existing password (first-time set or forgot-password reset).
     */
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

    await logActivity({
      storeId: store.id,
      userId: user.id,
      message: "Reset account password",
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        username: updated.username,
        role: updated.role,
        name: updated.name,
        storeId: updated.storeId,
        storeName: updated.store.name,
        storeCode: updated.store.storeCode,
        activeProfile: normalizeActiveProfile(updated.activeProfile),
      },
    });
  } catch (error) {
    return jsonAuthRouteError(error);
  }
}
