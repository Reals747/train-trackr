import { isFourthShiftArray } from "@/lib/hotschedules/client";
import type { FourthShift } from "@/lib/hotschedules/types";
import { prisma, prismaHasScheduleDayCache } from "@/lib/prisma";

export type CachedFourthShiftsDay = {
  shifts: FourthShift[];
  fetchedAt: Date;
};

export async function readScheduleDayCache(
  storeId: string,
  dateKey: string,
): Promise<CachedFourthShiftsDay | null> {
  if (!prismaHasScheduleDayCache()) return null;

  const row = await prisma.scheduleDayCache.findUnique({
    where: {
      storeId_dateKey: { storeId, dateKey },
    },
    select: { shifts: true, fetchedAt: true },
  });

  if (!row || !isFourthShiftArray(row.shifts)) return null;

  return {
    shifts: row.shifts,
    fetchedAt: row.fetchedAt,
  };
}

export async function writeScheduleDayCache(
  storeId: string,
  dateKey: string,
  shifts: FourthShift[],
): Promise<Date> {
  if (!prismaHasScheduleDayCache()) return new Date();

  const row = await prisma.scheduleDayCache.upsert({
    where: {
      storeId_dateKey: { storeId, dateKey },
    },
    create: {
      storeId,
      dateKey,
      shifts,
    },
    update: {
      shifts,
      fetchedAt: new Date(),
    },
    select: { fetchedAt: true },
  });

  return row.fetchedAt;
}
