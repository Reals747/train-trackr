import type { ActiveProfile } from "@/lib/profile";
import { fetchFourthSchedulesShiftsForDay } from "@/lib/hotschedules/client";
import {
  fourthSchedulesConfigErrorMessage,
  resolveFourthSchedulesConfig,
} from "@/lib/hotschedules/config";
import { mapFourthShiftsToScheduleEmployees } from "@/lib/hotschedules/mapper";
import {
  filterFourthShiftsForProfile,
  type ScheduleProfileFilters,
} from "@/lib/hotschedules/profile-filters";
import type { FourthShift } from "@/lib/hotschedules/types";
import { prismaHasScheduleBreakCompletion, prismaHasScheduleDayCache } from "@/lib/prisma";
import { readScheduleDayCache, writeScheduleDayCache } from "@/lib/schedule-cache-server";
import {
  loadScheduleBreakStates,
  purgeStaleScheduleBreakCompletions,
} from "@/lib/schedule-breaks-server";
import { mockScheduleEmployees } from "@/lib/schedule-mock";
import { getStoreProfileScheduleFilters } from "@/lib/store-profiles-server";
import {
  formatScheduleDayLabel,
  parseDateKey,
  toDateKey,
  type ScheduleBreakStatesByEmployee,
  type ScheduleDayPayload,
  type ScheduleEmployee,
  type ScheduleIntegrationInfo,
} from "@/lib/schedule";

export type LoadScheduleDayOptions = {
  /** When true, bypass the cached roster and fetch Fourth Schedules again. */
  forceRefresh?: boolean;
};

type ScheduleRosterPayload = Omit<ScheduleDayPayload, "breakStates">;

function basePayload(
  profileKey: ActiveProfile,
  dateKey: string,
  dayLabel: string,
): Pick<ScheduleRosterPayload, "profile" | "date" | "dayLabel"> {
  return {
    profile: profileKey,
    date: dateKey,
    dayLabel,
  };
}

function rosterPayload(
  base: Pick<ScheduleRosterPayload, "profile" | "date" | "dayLabel">,
  employees: ScheduleEmployee[],
  source: ScheduleRosterPayload["source"],
  integration: ScheduleIntegrationInfo,
  fetchedAt: Date | null,
  fromCache: boolean,
): ScheduleRosterPayload {
  return {
    ...base,
    employees,
    source,
    integration,
    fetchedAt: fetchedAt?.toISOString() ?? null,
    fromCache,
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
  payload: ScheduleRosterPayload,
): Promise<ScheduleDayPayload> {
  const breakStates = await loadBreakStates(storeId, profileKey, dateKey);
  return { ...payload, breakStates };
}

function mapProfileShiftsToEmployees(
  shifts: FourthShift[],
  profileFilters: ScheduleProfileFilters,
): ScheduleEmployee[] {
  const filtered = filterFourthShiftsForProfile(shifts, profileFilters);
  return mapFourthShiftsToScheduleEmployees(filtered);
}

/** One Fourth fetch (or cache read) per store + business day. */
async function loadFourthShiftsForStoreDay(
  storeId: string,
  dateKey: string,
  forceRefresh: boolean,
): Promise<{
  shifts: FourthShift[];
  fetchedAt: Date;
  fromCache: boolean;
}> {
  if (!forceRefresh && prismaHasScheduleDayCache()) {
    const cached = await readScheduleDayCache(storeId, dateKey);
    if (cached) {
      return { shifts: cached.shifts, fetchedAt: cached.fetchedAt, fromCache: true };
    }
  }

  const config = resolveFourthSchedulesConfig();
  if (config.mode !== "ready") {
    throw new Error("Fourth Schedules API is not ready.");
  }

  const shifts = await fetchFourthSchedulesShiftsForDay(config.credentials, dateKey);
  const fetchedAt = await writeScheduleDayCache(storeId, dateKey, shifts);

  return { shifts, fetchedAt, fromCache: false };
}

async function loadHotschedulesRoster(
  storeId: string,
  profileFilters: ScheduleProfileFilters,
  dateKey: string,
  forceRefresh: boolean,
): Promise<{
  employees: ScheduleEmployee[];
  fetchedAt: Date;
  fromCache: boolean;
}> {
  const { shifts, fetchedAt, fromCache } = await loadFourthShiftsForStoreDay(
    storeId,
    dateKey,
    forceRefresh,
  );

  return {
    employees: mapProfileShiftsToEmployees(shifts, profileFilters),
    fetchedAt,
    fromCache,
  };
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
  options: LoadScheduleDayOptions = {},
): Promise<ScheduleDayPayload> {
  if (prismaHasScheduleBreakCompletion()) {
    void purgeStaleScheduleBreakCompletions().catch((error) => {
      console.error("[schedule-server] purgeStaleScheduleBreakCompletions", error);
    });
  }

  const date = parseDateKey(dateKey) ?? new Date();
  const normalizedDate = toDateKey(date);
  const dayLabel = formatScheduleDayLabel(date);
  const base = basePayload(profileKey, normalizedDate, dayLabel);
  const forceRefresh = options.forceRefresh === true;

  const config = resolveFourthSchedulesConfig();

  if (config.mode === "disabled") {
    return withBreakStates(
      storeId,
      profileKey,
      normalizedDate,
      rosterPayload(
        base,
        mockScheduleEmployees(profileName, normalizedDate),
        "mock",
        { state: "mock" },
        null,
        false,
      ),
    );
  }

  if (config.mode === "misconfigured") {
    return withBreakStates(
      storeId,
      profileKey,
      normalizedDate,
      rosterPayload(
        base,
        [],
        "mock",
        {
          state: "config_error",
          missing: config.missing,
          message: fourthSchedulesConfigErrorMessage(config.missing),
        },
        null,
        false,
      ),
    );
  }

  const profileFilters = await getStoreProfileScheduleFilters(storeId, profileKey);

  try {
    const { employees, fetchedAt, fromCache } = await loadHotschedulesRoster(
      storeId,
      profileFilters,
      normalizedDate,
      forceRefresh,
    );

    return withBreakStates(
      storeId,
      profileKey,
      normalizedDate,
      rosterPayload(
        base,
        employees,
        "hotschedules",
        { state: "hotschedules" },
        fetchedAt,
        fromCache,
      ),
    );
  } catch (error) {
    const cached = !forceRefresh ? await readScheduleDayCache(storeId, normalizedDate) : null;
    if (cached) {
      return withBreakStates(
        storeId,
        profileKey,
        normalizedDate,
        rosterPayload(
          base,
          mapProfileShiftsToEmployees(cached.shifts, profileFilters),
          "hotschedules",
          {
            state: "api_error",
            message:
              error instanceof Error
                ? `${error.message} (showing cached roster from ${cached.fetchedAt.toISOString()})`
                : "Could not refresh schedule; showing cached roster.",
          },
          cached.fetchedAt,
          true,
        ),
      );
    }

    const message =
      error instanceof Error ? error.message : "Could not load schedule from Fourth Schedules API.";
    return withBreakStates(
      storeId,
      profileKey,
      normalizedDate,
      rosterPayload(base, [], "mock", { state: "api_error", message }, null, false),
    );
  }
}
