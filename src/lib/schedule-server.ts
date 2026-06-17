import type { ActiveProfile } from "@/lib/profile";
import {
  formatScheduleDayLabel,
  parseDateKey,
  toDateKey,
  type ScheduleDayPayload,
} from "@/lib/schedule";
import { mockScheduleEmployees } from "@/lib/schedule-mock";

/**
 * Load employees scheduled for a profile on a calendar day.
 * Today this returns profile-scoped mock data; later swap the body for HotSchedules (Fourth) API calls.
 */
export async function loadScheduleDay(
  _storeId: string,
  profileKey: ActiveProfile,
  profileName: string,
  dateKey: string,
): Promise<ScheduleDayPayload> {
  const date = parseDateKey(dateKey) ?? new Date();
  const normalizedDate = toDateKey(date);

  // Future: fetch from HotSchedules using store credentials + profile mapping.
  const employees = mockScheduleEmployees(profileName, normalizedDate);

  return {
    profile: profileKey,
    date: normalizedDate,
    dayLabel: formatScheduleDayLabel(date),
    employees,
    source: "mock",
  };
}
