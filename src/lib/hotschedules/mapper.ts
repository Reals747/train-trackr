import type { FourthShift } from "@/lib/hotschedules/types";
import {
  computeShiftBreakSlots,
  formatScheduleHour,
  formatShiftDuration,
  type ScheduleEmployee,
} from "@/lib/schedule";

/**
 * Fourth returns UTC timestamps like `2019-12-29T09:30:00:0000` (colon before fractional seconds).
 * Normalize to a parseable ISO string, then display in the store's local timezone.
 */
export function parseFourthDateTime(value: string): Date {
  const normalized = value
    .trim()
    .replace(/(\d{2}):(\d{4})$/, ".$2")
    .replace(/:(\d{3})$/, ".$1");
  const utc = normalized.endsWith("Z") ? normalized : `${normalized}Z`;
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid Fourth datetime: ${value}`);
  }
  return date;
}

function shiftDurationHours(shift: FourthShift): number {
  const start = parseFourthDateTime(shift.startDateTime);
  const end = parseFourthDateTime(shift.endDateTime);
  const hours = (end.getTime() - start.getTime()) / 3_600_000;
  return hours > 0 ? hours : 0;
}

function shiftTimeFrame(shift: FourthShift): string {
  const start = parseFourthDateTime(shift.startDateTime);
  const end = parseFourthDateTime(shift.endDateTime);
  const startHour = start.getHours() + start.getMinutes() / 60;
  const endHour = end.getHours() + end.getMinutes() / 60;
  if (endHour > startHour) {
    return `${formatScheduleHour(startHour)} - ${formatScheduleHour(endHour)}`;
  }
  return `${formatScheduleHour(startHour)} - ${formatScheduleHour(endHour)}`;
}

function shiftLabel(shift: FourthShift): string {
  const role = shift.roleName?.trim();
  if (role) return role;
  return `Employee ${shift.fourthAccountId.slice(-6)}`;
}

function shiftNotes(shift: FourthShift): string {
  const parts = [shift.departmentName, shift.locationName].map((part) => part?.trim()).filter(Boolean);
  if (shift.breakMinutes > 0) {
    parts.push(`${shift.breakMinutes}m break scheduled`);
  }
  return parts.join(" · ");
}

function shiftId(shift: FourthShift): string {
  return `fourth-${shift.fourthAccountId}-${shift.startDateTime}`;
}

/**
 * Map Fourth `/shifts` rows to Train Trackr schedule employees.
 * Employee display names are not in the Schedules API; UK Employee API can enrich later via `fourthAccountId`.
 */
export function mapFourthShiftsToScheduleEmployees(shifts: FourthShift[]): ScheduleEmployee[] {
  const sortedShifts = [...shifts].sort((left, right) => {
    const leftStart = parseFourthDateTime(left.startDateTime).getTime();
    const rightStart = parseFourthDateTime(right.startDateTime).getTime();
    return leftStart - rightStart;
  });

  return sortedShifts.map((shift) => {
    const durationHours = shiftDurationHours(shift);
    const breakSlots = durationHours > 0 ? computeShiftBreakSlots(durationHours) : {};

    return {
      id: shiftId(shift),
      name: shiftLabel(shift),
      shiftTimeFrame: shiftTimeFrame(shift),
      shiftDuration: durationHours > 0 ? formatShiftDuration(durationHours) : "—",
      shiftNotes: shiftNotes(shift),
      ...breakSlots,
    };
  });
}

/** @deprecated Use mapFourthShiftsToScheduleEmployees */
export const mapHotschedulesShiftsToScheduleEmployees = mapFourthShiftsToScheduleEmployees;
