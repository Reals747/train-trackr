import { z } from "zod";

/** Stable key tagging data rows (FOH, BOH, or custom store profile keys). */
export type DataProfile = string;
/** Per-user active profile filter — must match a store profile key. */
export type ActiveProfile = string;

/** Legacy built-in keys; new stores may define additional keys in StoreProfile. */
export const LEGACY_DATA_PROFILES = ["FOH", "BOH"] as const;

export const profileSchema = z.string().trim().min(1).max(64);
export const activeProfileSchema = profileSchema;

export function isDataProfile(value: string): value is DataProfile {
  return profileSchema.safeParse(value).success;
}

export function isActiveProfile(value: string): value is ActiveProfile {
  return profileSchema.safeParse(value).success;
}

/**
 * Coerce stored/legacy values to a valid active profile key for this store.
 * Falls back to the first configured profile, then FOH.
 */
export function normalizeActiveProfile(
  value: string | null | undefined,
  profileKeys?: readonly string[],
): ActiveProfile {
  if (value && profileKeys?.includes(value)) return value;
  if (value && (!profileKeys || profileKeys.length === 0) && isActiveProfile(value)) {
    return value;
  }
  return profileKeys?.[0] ?? "FOH";
}

/** Prisma where-clause fragment scoping a query to a single profile key. */
export function profileWhere(active: ActiveProfile): { profileKey: string } {
  return { profileKey: active };
}

/**
 * Resolve profile key for a write: explicit body value when valid, else caller's active profile.
 * Returns null only when an explicit value was provided but isn't valid.
 */
export function resolveWriteProfile(
  activeProfile: string,
  explicit?: string | null,
): DataProfile | null {
  if (explicit != null && explicit !== "") {
    const parsed = profileSchema.safeParse(explicit);
    if (parsed.success) return parsed.data;
    return null;
  }
  return normalizeActiveProfile(activeProfile);
}

/** Read `?profile=` from request URL; falls back to user's stored activeProfile. */
export function activeProfileFromRequest(
  request: Request,
  userActiveProfile: string,
  profileKeys?: readonly string[],
): ActiveProfile {
  const url = new URL(request.url);
  const param = url.searchParams.get("profile");
  if (param && isActiveProfile(param)) {
    if (!profileKeys || profileKeys.includes(param)) return param;
  }
  return normalizeActiveProfile(userActiveProfile, profileKeys);
}

/** Map a DB row to the API `profile` field (always the profileKey). */
export function apiProfileField(row: { profileKey?: string; profile?: string }): string {
  return row.profileKey ?? row.profile ?? "FOH";
}
