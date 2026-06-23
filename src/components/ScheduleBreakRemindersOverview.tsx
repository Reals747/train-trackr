"use client";

import { useMemo } from "react";
import {
  ScheduleUpcomingBreakCard,
  useScheduleBreakToggles,
} from "@/components/ScheduleBreakReminderCards";
import { collectUpcomingBreakReminders, type ScheduleDayPayload } from "@/lib/schedule";
import { useClientDateKey, useClientNow } from "@/lib/use-client-today";

type Props = {
  activeProfile?: string;
  canToggleBreaks?: boolean;
  dateKey?: string;
  schedule?: ScheduleDayPayload | null;
};

/**
 * Compact dashboard widget for today's upcoming schedule break reminders.
 * Uses the same reminder cards and toggle behavior as the Schedule tab header.
 */
export function ScheduleBreakRemindersOverview({
  activeProfile = "FOH",
  canToggleBreaks = true,
  dateKey: dateKeyProp,
  schedule,
}: Props) {
  const clientDateKey = useClientDateKey();
  const dateKey = dateKeyProp || clientDateKey;
  const isToday = Boolean(dateKey && clientDateKey && dateKey === clientDateKey);
  const now = useClientNow();

  const usingPrefetched =
    schedule != null && schedule.date === dateKey && schedule.profile === activeProfile;

  const { employees, handleBreakToggle, breakSaveError } = useScheduleBreakToggles({
    activeProfile,
    dateKey: dateKey ?? "",
    baseSchedule: usingPrefetched ? schedule : null,
    canToggleBreaks,
  });

  const integration = usingPrefetched ? schedule?.integration : undefined;
  const showIntegrationError =
    integration?.state === "config_error" || integration?.state === "api_error";

  const reminders = useMemo(
    () =>
      isToday && usingPrefetched && !showIntegrationError
        ? collectUpcomingBreakReminders(employees, now)
        : [],
    [employees, isToday, now, showIntegrationError, usingPrefetched],
  );

  if (!dateKey) {
    return <p className="text-sm opacity-70">Loading break reminders…</p>;
  }

  if (!usingPrefetched) {
    return <p className="text-sm opacity-70">Loading break reminders…</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium opacity-80">
        Today · <span className="font-semibold text-foreground">{schedule?.dayLabel ?? "—"}</span>
      </p>

      {breakSaveError ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-300/90 bg-rose-100 px-3 py-2 text-sm text-rose-950 dark:border-rose-500/50 dark:bg-rose-950/40 dark:text-rose-100"
        >
          <p className="font-semibold">Could not save break checkbox</p>
          <p className="mt-0.5 text-xs opacity-90">{breakSaveError}</p>
        </div>
      ) : null}

      {showIntegrationError ? (
        <p className="rounded-lg bg-slate-100 p-3 text-center text-sm opacity-80 dark:bg-slate-700">
          Schedule is unavailable — break reminders need a loaded roster.
        </p>
      ) : reminders.length === 0 ? (
        <p className="rounded-lg bg-slate-100 p-3 text-center text-sm opacity-80 dark:bg-slate-700">
          No upcoming breaks right now.
        </p>
      ) : (
        <ul className="max-h-40 space-y-2 overflow-y-auto overscroll-contain pr-1">
          {reminders.map((reminder) => (
            <li key={`${reminder.employeeId}-${reminder.breakKey}`}>
              <ScheduleUpcomingBreakCard
                reminder={reminder}
                canToggleBreaks={canToggleBreaks}
                onBreakToggle={handleBreakToggle}
                className="w-full"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
