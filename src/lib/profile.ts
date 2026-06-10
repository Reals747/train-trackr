import { Profile } from "@prisma/client";
import { z } from "zod";

/** Stored on data rows — exactly one restaurant area per record. */
export const DATA_PROFILES = ["FOH", "BOH"] as const;
export type DataProfile = (typeof DATA_PROFILES)[number];

/**
 * Per-user view filter. There are only two profiles now (FOH / BOH); the old "BOTH"
 * combined view has been removed, so the active profile is always a concrete data profile.
 */
export const ACTIVE_PROFILES = ["FOH", "BOH"] as const;
export type ActiveProfile = (typeof ACTIVE_PROFILES)[number];

export const profileSchema = z.enum(DATA_PROFILES);
export const activeProfileSchema = z.enum(ACTIVE_PROFILES);

export function isActiveProfile(value: string): value is ActiveProfile {
  return (ACTIVE_PROFILES as readonly string[]).includes(value);
}

export function isDataProfile(value: string): value is DataProfile {
  return (DATA_PROFILES as readonly string[]).includes(value);
}

/**
 * Coerce any stored/legacy value (including the removed "BOTH") to a valid active profile.
 * Falls back to FOH so accounts saved before BOTH was removed keep working.
 */
export function normalizeActiveProfile(value: string | null | undefined): ActiveProfile {
  return value && isActiveProfile(value) ? value : "FOH";
}

/** Prisma where-clause fragment scoping a query to a single profile. */
export function profileWhere(active: ActiveProfile): { profile: Profile } {
  return { profile: active as Profile };
}

/**
 * Resolve profile for a write: explicit body value when valid, else caller's active profile.
 * Returns null only when an explicit value was provided but isn't a valid profile.
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
): ActiveProfile {
  const url = new URL(request.url);
  const param = url.searchParams.get("profile");
  if (param && isActiveProfile(param)) return param;
  return normalizeActiveProfile(userActiveProfile);
}
