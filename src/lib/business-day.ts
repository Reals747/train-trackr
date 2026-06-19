import { toDateKey } from "@/lib/schedule";

/** Store operating day rolls at 3:00a local time (not midnight). */
export const BUSINESS_DAY_ROLLOVER_HOUR = 3;

/** Calendar date representing the current business day (before 3a counts as prior day). */
export function getBusinessCalendarDate(now = new Date()): Date {
  const adjusted = new Date(now);
  if (adjusted.getHours() < BUSINESS_DAY_ROLLOVER_HOUR) {
    adjusted.setDate(adjusted.getDate() - 1);
  }
  adjusted.setHours(0, 0, 0, 0);
  return adjusted;
}

/** Business day as `YYYY-MM-DD` for schedule, tasks, and break persistence. */
export function toBusinessDateKey(now = new Date()): string {
  return toDateKey(getBusinessCalendarDate(now));
}

/** JS weekday 0=Sun..6=Sat for the business calendar date. */
export function getBusinessWeekday(now = new Date()): number {
  return getBusinessCalendarDate(now).getDay();
}
