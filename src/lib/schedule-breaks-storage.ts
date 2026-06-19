export type ScheduleBreakKey = "break30Min" | "break10MinFirst" | "break10MinSecond";

export type ScheduleBreakState = Partial<Record<ScheduleBreakKey, boolean>>;

const STORAGE_PREFIX = "train-trackr:schedule-breaks";

function storageKey(profile: string, dateKey: string, employeeId: string): string {
  return `${STORAGE_PREFIX}:${profile}:${dateKey}:${employeeId}`;
}

export function readScheduleBreakState(
  profile: string,
  dateKey: string,
  employeeId: string,
): ScheduleBreakState {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(profile, dateKey, employeeId));
    if (!raw) return {};
    return JSON.parse(raw) as ScheduleBreakState;
  } catch {
    return {};
  }
}

export function writeScheduleBreakState(
  profile: string,
  dateKey: string,
  employeeId: string,
  breaks: ScheduleBreakState,
): void {
  if (typeof window === "undefined") return;
  const key = storageKey(profile, dateKey, employeeId);
  const hasValue = Object.keys(breaks).length > 0;
  if (!hasValue) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(breaks));
}

export function mergeScheduleBreakState(
  saved: ScheduleBreakState | undefined,
  employee: {
    break30Min?: boolean;
    break10MinFirst?: boolean;
    break10MinSecond?: boolean;
  },
): {
  break30Min?: boolean;
  break10MinFirst?: boolean;
  break10MinSecond?: boolean;
} {
  const breaks = saved ?? {};
  return {
    break30Min:
      employee.break30Min === undefined ? undefined : (breaks.break30Min ?? employee.break30Min),
    break10MinFirst:
      employee.break10MinFirst === undefined
        ? undefined
        : (breaks.break10MinFirst ?? employee.break10MinFirst),
    break10MinSecond:
      employee.break10MinSecond === undefined
        ? undefined
        : (breaks.break10MinSecond ?? employee.break10MinSecond),
  };
}

/** @deprecated Break state is stored in the database. Use mergeScheduleBreakState with API data. */
export function mergeScheduleBreakStateFromStorage(
  profile: string,
  dateKey: string,
  employee: {
    id: string;
    break30Min?: boolean;
    break10MinFirst?: boolean;
    break10MinSecond?: boolean;
  },
): {
  break30Min?: boolean;
  break10MinFirst?: boolean;
  break10MinSecond?: boolean;
} {
  return mergeScheduleBreakState(readScheduleBreakState(profile, dateKey, employee.id), employee);
}
