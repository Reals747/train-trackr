"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clientApi } from "@/lib/client-api";
import {
  mergeScheduleBreakState,
  type ScheduleBreakKey,
} from "@/lib/schedule-breaks-storage";
import {
  type ScheduleBreakStatesByEmployee,
  type ScheduleDayPayload,
  type ScheduleEmployee,
  type UpcomingBreakReminder,
} from "@/lib/schedule";

export function applyBreakStates(
  employees: ScheduleEmployee[],
  breakStates: ScheduleBreakStatesByEmployee = {},
): ScheduleEmployee[] {
  return employees.map((employee) => ({
    ...employee,
    ...mergeScheduleBreakState(breakStates[employee.id], employee),
  }));
}

export function useScheduleBreakToggles(options: {
  activeProfile: string;
  dateKey: string;
  baseSchedule: ScheduleDayPayload | null | undefined;
  canToggleBreaks: boolean;
}) {
  const { activeProfile, dateKey, baseSchedule, canToggleBreaks } = options;
  const [breakStateOverlay, setBreakStateOverlay] = useState<ScheduleBreakStatesByEmployee>({});
  const [breakSaveError, setBreakSaveError] = useState<string | null>(null);

  useEffect(() => {
    setBreakStateOverlay({});
    setBreakSaveError(null);
  }, [activeProfile, baseSchedule?.breakStates, dateKey]);

  const employees = useMemo(() => {
    if (!baseSchedule) return [];
    const mergedBreakStates = { ...(baseSchedule.breakStates ?? {}), ...breakStateOverlay };
    return applyBreakStates(baseSchedule.employees, mergedBreakStates);
  }, [baseSchedule, breakStateOverlay]);

  const handleBreakToggle = useCallback(
    async (employeeId: string, breakKey: ScheduleBreakKey, checked: boolean) => {
      if (!dateKey || !canToggleBreaks || !baseSchedule) return;

      const previousOverlay = breakStateOverlay;
      const nextOverlay: ScheduleBreakStatesByEmployee = {
        ...previousOverlay,
        [employeeId]: {
          ...(baseSchedule.breakStates[employeeId] ?? {}),
          ...(previousOverlay[employeeId] ?? {}),
          [breakKey]: checked,
        },
      };

      setBreakSaveError(null);
      setBreakStateOverlay(nextOverlay);

      try {
        await clientApi("/api/schedule/breaks", {
          method: "PATCH",
          body: JSON.stringify({
            profile: activeProfile,
            date: dateKey,
            employeeId,
            breakKey,
            completed: checked,
          }),
        });
      } catch (error) {
        setBreakStateOverlay(previousOverlay);
        setBreakSaveError(
          error instanceof Error ? error.message : "Could not save break state.",
        );
      }
    },
    [activeProfile, baseSchedule, breakStateOverlay, canToggleBreaks, dateKey],
  );

  return { employees, handleBreakToggle, breakSaveError };
}

function breakTypeDisplay(breakKey: UpcomingBreakReminder["breakKey"]): {
  badge: string;
  label: string;
  badgeClassName: string;
} {
  if (breakKey === "break30Min") {
    return {
      badge: "30m",
      label: "30 minute break",
      badgeClassName:
        "bg-amber-200/90 text-amber-950 ring-1 ring-amber-300/80 dark:bg-amber-900/70 dark:text-amber-50 dark:ring-amber-600/50",
    };
  }

  return {
    badge: "10m",
    label: breakKey === "break10MinFirst" ? "first 10 minute break" : "second 10 minute break",
    badgeClassName:
      "bg-sky-200/90 text-sky-950 ring-1 ring-sky-300/80 dark:bg-sky-900/70 dark:text-sky-50 dark:ring-sky-600/50",
  };
}

export function ScheduleUpcomingBreakCard({
  reminder,
  canToggleBreaks,
  onBreakToggle,
  className = "",
}: {
  reminder: UpcomingBreakReminder;
  canToggleBreaks: boolean;
  onBreakToggle: (employeeId: string, breakKey: ScheduleBreakKey, checked: boolean) => void;
  className?: string;
}) {
  const breakType = breakTypeDisplay(reminder.breakKey);

  return (
    <div
      className={`inline-flex min-w-0 items-center gap-2.5 rounded-lg border bg-slate-100 px-2.5 py-2 text-sm text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100 ${
        reminder.isOverdue
          ? "border-rose-500 ring-2 ring-rose-400/70 dark:border-rose-500 dark:ring-rose-500/60"
          : "border-slate-200 dark:border-slate-600"
      } ${className}`}
    >
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-md px-2 py-1 text-xs font-bold tracking-tight ${breakType.badgeClassName}`}
        aria-hidden
      >
        {breakType.badge}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="max-w-[8rem] truncate font-medium">{reminder.employeeName}</span>
        <span className="shrink-0 tabular-nums text-xs font-semibold opacity-70">{reminder.label}</span>
      </div>
      <input
        type="checkbox"
        checked={false}
        disabled={!canToggleBreaks}
        onChange={(event) => onBreakToggle(reminder.employeeId, reminder.breakKey, event.target.checked)}
        aria-label={`${breakType.label} for ${reminder.employeeName} at ${reminder.label}`}
        className="h-5 w-5 shrink-0 accent-slate-600 disabled:cursor-not-allowed disabled:opacity-60 dark:accent-slate-300"
      />
    </div>
  );
}
