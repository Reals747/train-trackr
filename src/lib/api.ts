import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAuthUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, type Permission } from "@/lib/permissions";

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

type RequireAuthOptions = {
  permission?: Permission;
  allowedRoles?: Role[];
};

export async function requireAuth(options?: RequireAuthOptions | Role[]) {
  const opts: RequireAuthOptions = Array.isArray(options)
    ? { allowedRoles: options }
    : options ?? {};

  const tokenUser = await getAuthUserFromCookie();
  if (!tokenUser) {
    return { error: errorResponse("Unauthorized", 401) };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: tokenUser.userId },
    select: { id: true, username: true, role: true, storeId: true, name: true },
  });
  if (!dbUser) {
    return { error: errorResponse("Unauthorized", 401) };
  }
  if (dbUser.storeId !== tokenUser.storeId) {
    return { error: errorResponse("Unauthorized", 401) };
  }

  if (opts.allowedRoles && !opts.allowedRoles.includes(dbUser.role)) {
    return { error: errorResponse("Forbidden", 403) };
  }
  if (opts.permission && !can(dbUser.role, opts.permission)) {
    return { error: errorResponse("Forbidden", 403) };
  }

  const user = {
    userId: dbUser.id,
    username: dbUser.username,
    role: dbUser.role,
    storeId: dbUser.storeId,
    name: dbUser.name,
  };

  return { user };
}

export async function requirePermission(permission: Permission) {
  return requireAuth({ permission });
}

/** Legacy role lists for `requireAuth([...roles])`. Prefer `requireAuth({ permission })` + `roles.json`. */
export const STORE_MANAGER_ROLES: Role[] = [Role.OWNER, Role.ADMIN];
export const TRAINING_STAFF_ROLES: Role[] = [Role.OWNER, Role.ADMIN, Role.TRAINER];

export function canEditTraining(role: Role) {
  return TRAINING_STAFF_ROLES.includes(role);
}
