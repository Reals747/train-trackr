/** Client-safe schedule types and date helpers (HotSchedules integration lives server-side). */

export type ScheduleEmployee = {
  id: string;
  name: string;
  shiftTimeFrame: string;
  shiftDuration: string;
  /** Omitted when this shift does not earn a 30-minute break. */
  break30Min?: boolean;
  /** Omitted when this shift does not earn a first 10-minute break. */
  break10MinFirst?: boolean;
  /** Omitted when this shift does not earn a second 10-minute break. */
  break10MinSecond?: boolean;
  shiftNotes: string;
};

export type ShiftBreakSlots = Pick<
  ScheduleEmployee,
  "break30Min" | "break10MinFirst" | "break10MinSecond"
>;

/**
 * Break slots earned by shift length (checkbox shown only when a slot is returned):
 * - 30 min: 5+ hours
 * - One 10 min: 3.5–6 hours
 * - Two 10 min: more than 6 hours (8 hr shifts → 30, 10, 10 in column order)
 */
export function computeShiftBreakSlots(durationHours: number): ShiftBreakSlots {
  const slots: ShiftBreakSlots = {};

  if (durationHours >= 5) {
    slots.break30Min = false;
  }

  if (durationHours >= 3.5 && durationHours <= 6) {
    slots.break10MinFirst = false;
  } else if (durationHours > 6) {
    slots.break10MinFirst = false;
    slots.break10MinSecond = false;
  }

  return slots;
}

export function buildScheduleShiftFields(
  startHour24: number,
  durationHours: number,
  shiftNotes = "",
): Pick<
  ScheduleEmployee,
  | "shiftTimeFrame"
  | "shiftDuration"
  | "break30Min"
  | "break10MinFirst"
  | "break10MinSecond"
  | "shiftNotes"
> {
  return {
    shiftTimeFrame: formatShiftTimeFrame(startHour24, durationHours),
    shiftDuration: formatShiftDuration(durationHours),
    shiftNotes,
    ...computeShiftBreakSlots(durationHours),
  };
}

export type ScheduleBreakStatesByEmployee = Partial<
  Record<
    string,
    Partial<Pick<ScheduleEmployee, "break30Min" | "break10MinFirst" | "break10MinSecond">>
  >
>;

export type ScheduleDayPayload = {
  profile: string;
  date: string;
  dayLabel: string;
  employees: ScheduleEmployee[];
  /** Checked breaks synced from the database for this store/profile/day. */
  breakStates: ScheduleBreakStatesByEmployee;
  /** Where the roster came from; `hotschedules` when live Fourth Schedules API sync succeeds. */
  source: "mock" | "hotschedules";
  /** Integration state for UI messaging (config errors, API failures, mock fallback). */
  integration: ScheduleIntegrationInfo;
};

export type ScheduleIntegrationInfo =
  | { state: "mock" }
  | { state: "hotschedules" }
  | { state: "config_error"; missing: string[]; message: string }
  | { state: "api_error"; message: string };

/** Profile display name used for default mock roster seed data. */
export const MOCK_SCHEDULE_PROFILE_NAME = "FOH Manchester Crenshaw";

/** Format a 24h time (fractional hours allowed) as e.g. `9:00a` or `8:30a`. */
export function formatScheduleHour(hour24: number): string {
  const totalMinutes = Math.round(hour24 * 60);
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  const period = hours >= 12 ? "p" : "a";
  const minuteLabel = minutes === 0 ? "00" : String(minutes).padStart(2, "0");
  return `${displayHour}:${minuteLabel}${period}`;
}

export function formatShiftTimeFrame(startHour24: number, durationHours: number): string {
  const endHour24 = startHour24 + durationHours;
  return `${formatScheduleHour(startHour24)} - ${formatScheduleHour(endHour24)}`;
}

export function formatShiftDuration(hours: number): string {
  const label = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(/\.0$/, "");
  return `${label} Hr${hours === 1 ? "" : "s"}.`;
}

/** Compact schedule time for break labels, e.g. `8a` or `8:30a`. */
export function formatScheduleHourCompact(hour24: number): string {
  return formatScheduleHour(hour24).replace(/:00([ap])$/, "$1");
}

/** Parse a schedule hour label such as `6:00a` or `12:30p` into fractional 24h time. */
export function parseScheduleHourLabel(label: string): number | null {
  const match = /^(\d{1,2}):(\d{2})([ap])$/i.exec(label.trim());
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3].toLowerCase();
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;

  if (period === "a") {
    if (hours === 12) hours = 0;
  } else if (hours !== 12) {
    hours += 12;
  }

  return hours + minutes / 60;
}

/** Read the shift start from a `shiftTimeFrame` string such as `6:00a - 2:00p`. */
export function parseShiftStartHour(shiftTimeFrame: string): number | null {
  const [startLabel] = shiftTimeFrame.split(/\s*-\s*/);
  if (!startLabel) return null;
  return parseScheduleHourLabel(startLabel);
}

/** HotSchedules roster order: earliest shift start first (openers → day → closers → evening). */
export function sortScheduleEmployeesByShiftStart(
  employees: ScheduleEmployee[],
): ScheduleEmployee[] {
  return [...employees].sort((left, right) => {
    const leftStart = parseShiftStartHour(left.shiftTimeFrame);
    const rightStart = parseShiftStartHour(right.shiftTimeFrame);
    if (leftStart == null && rightStart == null) return 0;
    if (leftStart == null) return 1;
    if (rightStart == null) return -1;
    return leftStart - rightStart;
  });
}

export type ScheduleBreakTimeLabels = {
  break30Min?: string;
  break10MinFirst?: string;
  break10MinSecond?: string;
};

export type ScheduleBreakSlotKey = "break30Min" | "break10MinFirst" | "break10MinSecond";

export type ScheduleBreakSlot = {
  key: ScheduleBreakSlotKey;
  hour24: number;
  label: string;
};

export type UpcomingBreakReminder = {
  employeeId: string;
  employeeName: string;
  breakKey: ScheduleBreakSlotKey;
  label: string;
  hour24: number;
  isOverdue: boolean;
};

/**
 * Break slots earned by a shift with fractional start hour and 2-hour spacing.
 * Example: 6:00a–2:00p with all three slots → 8a, 10a, 12p.
 */
export function listEmployeeBreakSlots(
  startHour24: number,
  employee: Pick<ScheduleEmployee, "break30Min" | "break10MinFirst" | "break10MinSecond">,
): ScheduleBreakSlot[] {
  const slots: ScheduleBreakSlot[] = [];
  let breakIndex = 0;

  if (employee.break30Min !== undefined) {
    breakIndex += 1;
    const hour24 = startHour24 + breakIndex * 2;
    slots.push({ key: "break30Min", hour24, label: formatScheduleHourCompact(hour24) });
  }
  if (employee.break10MinFirst !== undefined) {
    breakIndex += 1;
    const hour24 = startHour24 + breakIndex * 2;
    slots.push({ key: "break10MinFirst", hour24, label: formatScheduleHourCompact(hour24) });
  }
  if (employee.break10MinSecond !== undefined) {
    breakIndex += 1;
    const hour24 = startHour24 + breakIndex * 2;
    slots.push({ key: "break10MinSecond", hour24, label: formatScheduleHourCompact(hour24) });
  }

  return slots;
}

/**
 * Suggested break times at 2-hour intervals from shift start, in column order.
 * Example: 6:00a–2:00p with all three slots → 8a, 10a, 12p.
 */
export function computeBreakTimeLabels(
  startHour24: number,
  employee: Pick<ScheduleEmployee, "break30Min" | "break10MinFirst" | "break10MinSecond">,
): ScheduleBreakTimeLabels {
  const labels: ScheduleBreakTimeLabels = {};
  for (const slot of listEmployeeBreakSlots(startHour24, employee)) {
    labels[slot.key] = slot.label;
  }
  return labels;
}

/** Local calendar date/time for a break hour on the same day as `day`. */
export function breakDateTimeOnDay(breakHour24: number, day: Date): Date {
  const result = new Date(day);
  const wholeHours = Math.floor(breakHour24);
  const minutes = Math.round((breakHour24 - wholeHours) * 60);
  result.setHours(wholeHours, minutes, 0, 0);
  return result;
}

/** True when a break falls between `now` and `now + windowMinutes`. */
export function isBreakDueInNextWindow(
  breakHour24: number,
  now: Date,
  windowMinutes = 30,
): boolean {
  const breakAt = breakDateTimeOnDay(breakHour24, now);
  const windowEnd = new Date(now.getTime() + windowMinutes * 60_000);
  return breakAt >= now && breakAt <= windowEnd;
}

/**
 * Reminder cards appear once a break is within the next half hour and stay until checked,
 * including after the scheduled time passes.
 */
export function isBreakReminderVisible(
  breakHour24: number,
  now: Date,
  windowMinutes = 30,
): boolean {
  const breakAt = breakDateTimeOnDay(breakHour24, now);
  const windowEnd = new Date(now.getTime() + windowMinutes * 60_000);
  return breakAt <= windowEnd;
}

/** True when an unchecked break is at least `overdueMinutes` past its scheduled time. */
export function isBreakOverdue(
  breakHour24: number,
  now: Date,
  overdueMinutes = 30,
): boolean {
  const breakAt = breakDateTimeOnDay(breakHour24, now);
  return now.getTime() - breakAt.getTime() >= overdueMinutes * 60_000;
}

/** Unchecked breaks due now or earlier, plus those in the next half hour. Sorted soonest first. */
export function collectUpcomingBreakReminders(
  employees: ScheduleEmployee[],
  now: Date,
  windowMinutes = 30,
): UpcomingBreakReminder[] {
  const reminders: UpcomingBreakReminder[] = [];

  for (const employee of employees) {
    const startHour = parseShiftStartHour(employee.shiftTimeFrame);
    if (startHour == null) continue;

    for (const slot of listEmployeeBreakSlots(startHour, employee)) {
      if (employee[slot.key]) continue;
      if (!isBreakReminderVisible(slot.hour24, now, windowMinutes)) continue;
      reminders.push({
        employeeId: employee.id,
        employeeName: employee.name,
        breakKey: slot.key,
        label: slot.label,
        hour24: slot.hour24,
        isOverdue: isBreakOverdue(slot.hour24, now, windowMinutes),
      });
    }
  }

  return reminders.sort((left, right) => left.hour24 - right.hour24);
}

/** ISO date `YYYY-MM-DD` in local time. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parse `YYYY-MM-DD` as a local calendar date, or null when invalid. */
export function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (toDateKey(date) !== value.trim()) return null;
  return date;
}

export function formatScheduleDayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
