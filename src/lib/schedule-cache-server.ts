import { prisma, prismaHasScheduleDayCache } from "@/lib/prisma";
import type { ScheduleEmployee } from "@/lib/schedule";

export type CachedScheduleDay = {
  employees: ScheduleEmployee[];
  source: "mock" | "hotschedules";
  fetchedAt: Date;
};

function isScheduleEmployeeArray(value: unknown): value is ScheduleEmployee[] {
  return Array.isArray(value);
}

export async function readScheduleDayCache(
  storeId: string,
  profileKey: string,
  dateKey: string,
): Promise<CachedScheduleDay | null> {
  if (!prismaHasScheduleDayCache()) return null;

  const row = await prisma.scheduleDayCache.findUnique({
    where: {
      storeId_profileKey_dateKey: { storeId, profileKey, dateKey },
    },
    select: { employees: true, source: true, fetchedAt: true },
  });

  if (!row || !isScheduleEmployeeArray(row.employees)) return null;

  return {
    employees: row.employees,
    source: row.source === "hotschedules" ? "hotschedules" : "mock",
    fetchedAt: row.fetchedAt,
  };
}

export async function writeScheduleDayCache(
  storeId: string,
  profileKey: string,
  dateKey: string,
  employees: ScheduleEmployee[],
  source: "mock" | "hotschedules",
): Promise<Date> {
  if (!prismaHasScheduleDayCache()) return new Date();

  const row = await prisma.scheduleDayCache.upsert({
    where: {
      storeId_profileKey_dateKey: { storeId, profileKey, dateKey },
    },
    create: {
      storeId,
      profileKey,
      dateKey,
      employees,
      source,
    },
    update: {
      employees,
      source,
      fetchedAt: new Date(),
    },
    select: { fetchedAt: true },
  });

  return row.fetchedAt;
}
