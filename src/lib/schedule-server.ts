import type { ActiveProfile } from "@/lib/profile";
import {
  hotschedulesConfigErrorMessage,
  resolveHotschedulesConfig,
} from "@/lib/hotschedules/config";
import {
  fetchHotschedulesShiftsForDay,
  fetchHotschedulesStoreEmployees,
} from "@/lib/hotschedules/client";
import { mapHotschedulesShiftsToScheduleEmployees } from "@/lib/hotschedules/mapper";
import { mockScheduleEmployees } from "@/lib/schedule-mock";
import {
  formatScheduleDayLabel,
  parseDateKey,
  toDateKey,
  type ScheduleDayPayload,
} from "@/lib/schedule";

function basePayload(
  profileKey: ActiveProfile,
  dateKey: string,
  dayLabel: string,
): Omit<ScheduleDayPayload, "employees" | "source" | "integration"> {
  return {
    profile: profileKey,
    date: dateKey,
    dayLabel,
  };
}

/**
 * Load employees scheduled for a profile on a calendar day.
 * Uses HotSchedules when `HOTSCHEDULES_ENABLED=true` and env is complete; otherwise mock data.
 */
export async function loadScheduleDay(
  _storeId: string,
  profileKey: ActiveProfile,
  profileName: string,
  dateKey: string,
): Promise<ScheduleDayPayload> {
  const date = parseDateKey(dateKey) ?? new Date();
  const normalizedDate = toDateKey(date);
  const dayLabel = formatScheduleDayLabel(date);
  const base = basePayload(profileKey, normalizedDate, dayLabel);

  const config = resolveHotschedulesConfig();

  if (config.mode === "disabled") {
    return {
      ...base,
      employees: mockScheduleEmployees(profileName, normalizedDate),
      source: "mock",
      integration: { state: "mock" },
    };
  }

  if (config.mode === "misconfigured") {
    return {
      ...base,
      employees: [],
      source: "mock",
      integration: {
        state: "config_error",
        missing: config.missing,
        message: hotschedulesConfigErrorMessage(config.missing),
      },
    };
  }

  try {
    const [shifts, employees] = await Promise.all([
      fetchHotschedulesShiftsForDay(config.credentials, normalizedDate),
      fetchHotschedulesStoreEmployees(config.credentials),
    ]);

    return {
      ...base,
      employees: mapHotschedulesShiftsToScheduleEmployees(shifts, employees),
      source: "hotschedules",
      integration: { state: "hotschedules" },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load schedule from HotSchedules.";
    return {
      ...base,
      employees: [],
      source: "mock",
      integration: {
        state: "api_error",
        message,
      },
    };
  }
}
