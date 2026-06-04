import { Profile } from "@prisma/client";
import { z } from "zod";

/** Stored on data rows — exactly one restaurant area per record. */
export const DATA_PROFILES = ["FOH", "BOH"] as const;
export type DataProfile = (typeof DATA_PROFILES)[number];

/** Per-user view filter; BOTH shows all profiles. */
export const ACTIVE_PROFILES = ["FOH", "BOH", "BOTH"] as const;
export type ActiveProfile = (typeof ACTIVE_PROFILES)[number];

export const profileSchema = z.enum(DATA_PROFILES);
export const activeProfileSchema = z.enum(ACTIVE_PROFILES);

export function isActiveProfile(value: string): value is ActiveProfile {
  return (ACTIVE_PROFILES as readonly string[]).includes(value);
}

export function isDataProfile(value: string): value is DataProfile {
  return (DATA_PROFILES as readonly string[]).includes(value);
}

/** Prisma where-clause fragment: no filter when BOTH, else match profile. */
export function profileWhere(active: ActiveProfile): { profile?: Profile } {
  if (active === "BOTH") return {};
  return { profile: active as Profile };
}

/**
 * Resolve profile for a write: explicit body value, else caller's active profile.
 * Returns null when active is BOTH and no explicit profile was provided.
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
  if (activeProfile === "FOH" || activeProfile === "BOH") {
    return activeProfile;
  }
  return null;
}

/** Read `?profile=` from request URL; falls back to user's stored activeProfile. */
export function activeProfileFromRequest(
  request: Request,
  userActiveProfile: string,
): ActiveProfile {
  const url = new URL(request.url);
  const param = url.searchParams.get("profile");
  if (param && isActiveProfile(param)) return param;
  if (isActiveProfile(userActiveProfile)) return userActiveProfile;
  return "FOH";
}
