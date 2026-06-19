import { prisma } from "@/lib/prisma";
import type { ScheduleBreakKey, ScheduleBreakState } from "@/lib/schedule-breaks-storage";

const BREAK_KEYS: ScheduleBreakKey[] = ["break30Min", "break10MinFirst", "break10MinSecond"];

export type ScheduleBreakStateMap = Record<string, ScheduleBreakState>;

function isScheduleBreakKey(value: string): value is ScheduleBreakKey {
  return (BREAK_KEYS as string[]).includes(value);
}

export async function loadScheduleBreakStates(
  storeId: string,
  profileKey: string,
  dateKey: string,
): Promise<ScheduleBreakStateMap> {
  const rows = await prisma.scheduleBreakCompletion.findMany({
    where: { storeId, profileKey, dateKey, completed: true },
    select: { employeeId: true, breakKey: true },
  });

  const map: ScheduleBreakStateMap = {};
  for (const row of rows) {
    if (!isScheduleBreakKey(row.breakKey)) continue;
    map[row.employeeId] ??= {};
    map[row.employeeId][row.breakKey] = true;
  }
  return map;
}

export async function setScheduleBreakCompleted(
  storeId: string,
  profileKey: string,
  dateKey: string,
  employeeId: string,
  breakKey: ScheduleBreakKey,
  completed: boolean,
): Promise<void> {
  const where = {
    storeId_profileKey_dateKey_employeeId_breakKey: {
      storeId,
      profileKey,
      dateKey,
      employeeId,
      breakKey,
    },
  };

  if (completed) {
    await prisma.scheduleBreakCompletion.upsert({
      where,
      create: {
        storeId,
        profileKey,
        dateKey,
        employeeId,
        breakKey,
        completed: true,
      },
      update: { completed: true },
    });
    return;
  }

  await prisma.scheduleBreakCompletion.deleteMany({
    where: {
      storeId,
      profileKey,
      dateKey,
      employeeId,
      breakKey,
    },
  });
}
