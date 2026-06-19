import type { FourthShift } from "@/lib/hotschedules/types";

export type ScheduleProfileFilters = {
  /** Substring match against Fourth `locationName` (e.g. "Cienega Triangle"). */
  locationKeyword: string | null;
  /** Substring match against Fourth `departmentName` (e.g. "Front of House"). */
  departmentKeyword: string | null;
};

export type ScheduleProfileFilterSource = {
  name: string;
  scheduleLocationKeyword?: string | null;
  scheduleDepartmentKeyword?: string | null;
};

/** Fourth department labels for FOH/BOH profile name prefixes. */
const FOH_DEPARTMENT_KEYWORD = "Front of House";
const BOH_DEPARTMENT_KEYWORD = "Back of House";

/**
 * Resolve Fourth shift filter keywords for a Train Trackr profile.
 * Explicit DB keywords win; otherwise parse `"FOH Cienega Triangle"`-style names.
 */
export function resolveScheduleProfileFilters(
  profile: ScheduleProfileFilterSource,
): ScheduleProfileFilters {
  const locationFromDb = profile.scheduleLocationKeyword?.trim() || null;
  const departmentFromDb = profile.scheduleDepartmentKeyword?.trim() || null;

  if (locationFromDb || departmentFromDb) {
    return {
      locationKeyword: locationFromDb,
      departmentKeyword: departmentFromDb,
    };
  }

  return parseScheduleFiltersFromProfileName(profile.name);
}

/**
 * Parse `"FOH Cienega Triangle"` → location `Cienega Triangle`, dept `Front of House`.
 * `"BOH Manchester Crenshaw"` → location `Manchester Crenshaw`, dept `Back of House`.
 */
export function parseScheduleFiltersFromProfileName(name: string): ScheduleProfileFilters {
  const match = name.trim().match(/^(FOH|BOH)\s+(.+)$/i);
  if (!match) {
    return { locationKeyword: null, departmentKeyword: null };
  }

  const area = match[1].toUpperCase();
  return {
    locationKeyword: match[2].trim(),
    departmentKeyword: area === "FOH" ? FOH_DEPARTMENT_KEYWORD : BOH_DEPARTMENT_KEYWORD,
  };
}

function fieldContainsKeyword(field: string | undefined, keyword: string): boolean {
  if (!keyword) return true;
  const haystack = field?.trim().toLowerCase() ?? "";
  return haystack.includes(keyword.trim().toLowerCase());
}

/** Keep shifts whose Fourth location/department match the profile keywords. */
export function filterFourthShiftsForProfile(
  shifts: FourthShift[],
  filters: ScheduleProfileFilters,
): FourthShift[] {
  if (!filters.locationKeyword && !filters.departmentKeyword) {
    return [];
  }

  return shifts.filter(
    (shift) =>
      fieldContainsKeyword(shift.locationName, filters.locationKeyword ?? "") &&
      fieldContainsKeyword(shift.departmentName, filters.departmentKeyword ?? ""),
  );
}
