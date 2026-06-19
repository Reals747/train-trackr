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

export type ScheduleDayPayload = {
  profile: string;
  date: string;
  dayLabel: string;
  employees: ScheduleEmployee[];
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

/**
 * Suggested break times at 2-hour intervals from shift start, in column order.
 * Example: 6:00a–2:00p with all three slots → 8a, 10a, 12p.
 */
export function computeBreakTimeLabels(
  startHour24: number,
  employee: Pick<ScheduleEmployee, "break30Min" | "break10MinFirst" | "break10MinSecond">,
): ScheduleBreakTimeLabels {
  const labels: ScheduleBreakTimeLabels = {};
  let breakIndex = 0;

  if (employee.break30Min !== undefined) {
    breakIndex += 1;
    labels.break30Min = formatScheduleHourCompact(startHour24 + breakIndex * 2);
  }
  if (employee.break10MinFirst !== undefined) {
    breakIndex += 1;
    labels.break10MinFirst = formatScheduleHourCompact(startHour24 + breakIndex * 2);
  }
  if (employee.break10MinSecond !== undefined) {
    breakIndex += 1;
    labels.break10MinSecond = formatScheduleHourCompact(startHour24 + breakIndex * 2);
  }

  return labels;
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
