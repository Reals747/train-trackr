import type { ActiveProfile } from "@/lib/profile";
import { prismaHasScheduleBreakCompletion } from "@/lib/prisma";
import { fetchFourthSchedulesShiftsForDay } from "@/lib/hotschedules/client";
import {
  fourthSchedulesConfigErrorMessage,
  resolveFourthSchedulesConfig,
} from "@/lib/hotschedules/config";
import { mapFourthShiftsToScheduleEmployees } from "@/lib/hotschedules/mapper";
import { loadScheduleBreakStates } from "@/lib/schedule-breaks-server";
import { mockScheduleEmployees } from "@/lib/schedule-mock";
import {
  formatScheduleDayLabel,
  parseDateKey,
  toDateKey,
  type ScheduleBreakStatesByEmployee,
  type ScheduleDayPayload,
} from "@/lib/schedule";

function basePayload(
  profileKey: ActiveProfile,
  dateKey: string,
  dayLabel: string,
): Omit<ScheduleDayPayload, "employees" | "source" | "integration" | "breakStates"> {
  return {
    profile: profileKey,
    date: dateKey,
    dayLabel,
  };
}

async function loadBreakStates(
  storeId: string,
  profileKey: ActiveProfile,
  dateKey: string,
): Promise<ScheduleBreakStatesByEmployee> {
  if (!prismaHasScheduleBreakCompletion()) return {};
  try {
    return await loadScheduleBreakStates(storeId, profileKey, dateKey);
  } catch (error) {
    console.error("[schedule-server] loadScheduleBreakStates", error);
    return {};
  }
}

async function withBreakStates(
  storeId: string,
  profileKey: ActiveProfile,
  dateKey: string,
  payload: Omit<ScheduleDayPayload, "breakStates">,
): Promise<ScheduleDayPayload> {
  const breakStates = await loadBreakStates(storeId, profileKey, dateKey);
  return { ...payload, breakStates };
}

/**
 * Load employees scheduled for a profile on a calendar day.
 * Uses Fourth Schedules API when enabled and configured; otherwise mock data.
 */
export async function loadScheduleDay(
  storeId: string,
  profileKey: ActiveProfile,
  profileName: string,
  dateKey: string,
): Promise<ScheduleDayPayload> {
  const date = parseDateKey(dateKey) ?? new Date();
  const normalizedDate = toDateKey(date);
  const dayLabel = formatScheduleDayLabel(date);
  const base = basePayload(profileKey, normalizedDate, dayLabel);

  const config = resolveFourthSchedulesConfig();

  if (config.mode === "disabled") {
    return withBreakStates(storeId, profileKey, normalizedDate, {
      ...base,
      employees: mockScheduleEmployees(profileName, normalizedDate),
      source: "mock",
      integration: { state: "mock" },
    });
  }

  if (config.mode === "misconfigured") {
    return withBreakStates(storeId, profileKey, normalizedDate, {
      ...base,
      employees: [],
      source: "mock",
      integration: {
        state: "config_error",
        missing: config.missing,
        message: fourthSchedulesConfigErrorMessage(config.missing),
      },
    });
  }

  try {
    const shifts = await fetchFourthSchedulesShiftsForDay(config.credentials, normalizedDate);

    return withBreakStates(storeId, profileKey, normalizedDate, {
      ...base,
      employees: mapFourthShiftsToScheduleEmployees(shifts),
      source: "hotschedules",
      integration: { state: "hotschedules" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load schedule from Fourth Schedules API.";
    return withBreakStates(storeId, profileKey, normalizedDate, {
      ...base,
      employees: [],
      source: "mock",
      integration: {
        state: "api_error",
        message,
      },
    });
  }
}
