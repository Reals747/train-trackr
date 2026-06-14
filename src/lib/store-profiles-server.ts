import { Profile } from "@prisma/client";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  isProfileColor,
  profileKeyFromName,
  serializeStoreProfile,
  type ProfileColor,
  type StoreProfileRow,
} from "@/lib/store-profiles";

export const DEFAULT_STORE_PROFILES: Array<{
  key: string;
  name: string;
  color: ProfileColor;
  sortOrder: number;
}> = [
  { key: "FOH", name: "FOH", color: "sky", sortOrder: 0 },
  { key: "BOH", name: "BOH", color: "amber", sortOrder: 1 },
];

export function legacyProfileEnum(profileKey: string): Profile | undefined {
  if (profileKey === "FOH" || profileKey === "BOH") return profileKey;
  return undefined;
}

export function profileWriteData(profileKey: string): {
  profileKey: string;
  profile?: Profile;
} {
  const legacy = legacyProfileEnum(profileKey);
  return legacy ? { profileKey, profile: legacy } : { profileKey };
}

export async function ensureDefaultStoreProfiles(
  storeId: string,
  db: PrismaClient | Prisma.TransactionClient = prisma,
) {
  const existing = await db.storeProfile.count({ where: { storeId } });
  if (existing > 0) return;
  await db.storeProfile.createMany({
    data: DEFAULT_STORE_PROFILES.map((profile) => ({
      storeId,
      key: profile.key,
      name: profile.name,
      color: profile.color,
      sortOrder: profile.sortOrder,
    })),
  });
}

export async function listStoreProfiles(storeId: string): Promise<StoreProfileRow[]> {
  await ensureDefaultStoreProfiles(storeId);
  const rows = await prisma.storeProfile.findMany({
    where: { storeId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, key: true, name: true, color: true, sortOrder: true },
  });
  return rows.map((row) => serializeStoreProfile(row));
}

export async function storeProfileKeyExists(storeId: string, key: string) {
  const count = await prisma.storeProfile.count({ where: { storeId, key } });
  return count > 0;
}

export async function generateUniqueProfileKey(storeId: string, name: string) {
  let base = profileKeyFromName(name);
  let key = base;
  let suffix = 2;
  while (await storeProfileKeyExists(storeId, key)) {
    key = `${base}_${suffix}`;
    suffix += 1;
  }
  return key;
}

export async function countProfileKeyUsage(storeId: string, key: string) {
  const [positions, trainees, taskRows, taskPresets, taskArchives, activeUsers] =
    await Promise.all([
      prisma.position.count({ where: { storeId, profileKey: key } }),
      prisma.trainee.count({ where: { storeId, profileKey: key } }),
      prisma.taskRow.count({ where: { storeId, profileKey: key } }),
      prisma.taskPreset.count({ where: { storeId, profileKey: key } }),
      prisma.taskWeekArchive.count({ where: { storeId, profileKey: key } }),
      prisma.user.count({ where: { storeId, activeProfile: key } }),
    ]);
  return positions + trainees + taskRows + taskPresets + taskArchives + activeUsers;
}

export async function assertStoreProfileKey(storeId: string, key: string) {
  await ensureDefaultStoreProfiles(storeId);
  const exists = await storeProfileKeyExists(storeId, key);
  return exists ? key : null;
}
