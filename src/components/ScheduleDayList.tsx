"use client";

import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { clientApi } from "@/lib/client-api";
import { FOURTH_SCHEDULES_ENV_KEYS } from "@/lib/hotschedules/constants";
import {
  mergeScheduleBreakState,
  type ScheduleBreakKey,
} from "@/lib/schedule-breaks-storage";
import {
  type ScheduleBreakStatesByEmployee,
  type ScheduleDayPayload,
  type ScheduleEmployee,
  type ScheduleIntegrationInfo,
  type UpcomingBreakReminder,
  collectUpcomingBreakReminders,
  computeBreakTimeLabels,
  parseShiftStartHour,
} from "@/lib/schedule";
import { MOCK_SCHEDULE_PROFILE_NAME } from "@/lib/schedule";
import { useClientDateKey, useClientNow } from "@/lib/use-client-today";

type Props = {
  activeProfile?: string;
  canToggleBreaks?: boolean;
  /** When provided with `schedule`, skips a redundant fetch for today's roster. */
  dateKey?: string;
  schedule?: ScheduleDayPayload | null;
  /** Called after a manual Fourth Schedules refresh so parent prefetch stays in sync. */
  onScheduleUpdated?: (schedule: ScheduleDayPayload) => void;
};

/** Fluid text columns + fixed 30m / 10m / 10m break columns (checkbox + time label). */
const SCHEDULE_ROW_GRID =
  "grid w-full grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.55fr)_minmax(3.5rem,auto)_minmax(3.5rem,auto)_minmax(3.5rem,auto)_minmax(0,0.75fr)] items-center gap-x-1.5 gap-y-1 sm:gap-x-2 lg:gap-x-3";

const SCHEDULE_BREAK_COLS =
  "grid grid-cols-[minmax(3.5rem,auto)_minmax(3.5rem,auto)_minmax(3.5rem,auto)] items-center gap-x-1.5 sm:gap-x-2 lg:gap-x-3";

function breakTimeLabelsForEmployee(employee: ScheduleEmployee) {
  const startHour = parseShiftStartHour(employee.shiftTimeFrame);
  if (startHour == null) return {};
  return computeBreakTimeLabels(startHour, employee);
}

function employeeHasBreakSlots(employee: ScheduleEmployee): boolean {
  return (
    employee.break30Min !== undefined ||
    employee.break10MinFirst !== undefined ||
    employee.break10MinSecond !== undefined
  );
}

function applyBreakStates(
  employees: ScheduleEmployee[],
  breakStates: ScheduleBreakStatesByEmployee = {},
): ScheduleEmployee[] {
  return employees.map((employee) => ({
    ...employee,
    ...mergeScheduleBreakState(breakStates[employee.id], employee),
  }));
}

function ScheduleIntegrationNotice({ integration }: { integration: ScheduleIntegrationInfo }) {
  if (integration.state === "mock" || integration.state === "hotschedules") {
    return null;
  }

  if (integration.state === "config_error") {
    return (
      <div
        role="alert"
        className="rounded-lg border border-amber-300/90 bg-amber-100 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/50 dark:bg-amber-900/40 dark:text-amber-100"
      >
        <p className="font-semibold">Fourth Schedules API is not configured</p>
        <p className="mt-1 opacity-90">{integration.message}</p>
        <ul className="mt-2 list-inside list-disc text-xs opacity-90">
          {integration.missing.map((key) => (
            <li key={key}>
              <code className="font-mono">{key}</code>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs opacity-80">
          Set <code className="font-mono">FOURTH_SCHEDULES_ENABLED=true</code> and fill in{" "}
          {FOURTH_SCHEDULES_ENV_KEYS.join(", ")} in your server environment (e.g. Vercel or{" "}
          <code className="font-mono">.env.local</code>). See{" "}
          <code className="font-mono">.env.example</code> and{" "}
          <code className="font-mono">docs/integrations/hotschedules/ARCHITECTURE.md</code>.
        </p>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="rounded-lg border border-rose-300/90 bg-rose-100 px-4 py-3 text-sm text-rose-950 dark:border-rose-500/50 dark:bg-rose-950/40 dark:text-rose-100"
    >
      <p className="font-semibold">Could not load schedule from Fourth Schedules API</p>
      <p className="mt-1 opacity-90">{integration.message}</p>
    </div>
  );
}

function ScheduleBreakCell({
  value,
  label,
  canToggle,
  onToggle,
  timeLabel,
}: {
  value: boolean | undefined;
  label: string;
  canToggle: boolean;
  onToggle: (checked: boolean) => void;
  timeLabel?: string;
}) {
  if (value === undefined) {
    return <span className="flex min-h-4 w-full justify-center" aria-hidden />;
  }

  const ariaLabel = timeLabel ? `${label} at ${timeLabel}` : label;

  return (
    <span className="inline-flex min-w-0 flex-col items-center justify-center gap-1">
      {timeLabel ? (
        <span className="text-[10px] font-medium leading-none tabular-nums opacity-80 sm:text-xs">
          {timeLabel}
        </span>
      ) : null}
      <input
        type="checkbox"
        checked={value}
        disabled={!canToggle}
        onChange={(event) => onToggle(event.target.checked)}
        aria-label={ariaLabel}
        className="h-4 w-4 shrink-0 accent-slate-600 disabled:cursor-not-allowed disabled:opacity-60 dark:accent-slate-300"
      />
    </span>
  );
}

function ScheduleEmployeeBreaks({
  employee,
  canToggleBreaks,
  onBreakToggle,
}: {
  employee: ScheduleEmployee;
  canToggleBreaks: boolean;
  onBreakToggle: (employeeId: string, breakKey: ScheduleBreakKey, checked: boolean) => void;
}) {
  const breakTimes = breakTimeLabelsForEmployee(employee);

  return (
    <>
      <ScheduleBreakCell
        value={employee.break30Min}
        label={`30 minute break for ${employee.name}`}
        timeLabel={breakTimes.break30Min}
        canToggle={canToggleBreaks}
        onToggle={(checked) => onBreakToggle(employee.id, "break30Min", checked)}
      />
      <ScheduleBreakCell
        value={employee.break10MinFirst}
        label={`First 10 minute break for ${employee.name}`}
        timeLabel={breakTimes.break10MinFirst}
        canToggle={canToggleBreaks}
        onToggle={(checked) => onBreakToggle(employee.id, "break10MinFirst", checked)}
      />
      <ScheduleBreakCell
        value={employee.break10MinSecond}
        label={`Second 10 minute break for ${employee.name}`}
        timeLabel={breakTimes.break10MinSecond}
        canToggle={canToggleBreaks}
        onToggle={(checked) => onBreakToggle(employee.id, "break10MinSecond", checked)}
      />
    </>
  );
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

function ScheduleUpcomingBreakCard({
  reminder,
  canToggleBreaks,
  onBreakToggle,
}: {
  reminder: UpcomingBreakReminder;
  canToggleBreaks: boolean;
  onBreakToggle: (employeeId: string, breakKey: ScheduleBreakKey, checked: boolean) => void;
}) {
  const breakType = breakTypeDisplay(reminder.breakKey);

  return (
    <div
      className={`inline-flex min-w-0 items-center gap-2.5 rounded-lg border bg-slate-100 px-2.5 py-2 text-sm text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100 ${
        reminder.isOverdue
          ? "border-rose-500 ring-2 ring-rose-400/70 dark:border-rose-500 dark:ring-rose-500/60"
          : "border-slate-200 dark:border-slate-600"
      }`}
    >
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-md px-2 py-1 text-xs font-bold tracking-tight ${breakType.badgeClassName}`}
        aria-hidden
      >
        {breakType.badge}
      </span>
      <div className="flex min-w-0 items-center gap-2">
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

function ScheduleUpcomingBreaks({
  employees,
  canToggleBreaks,
  onBreakToggle,
  show,
}: {
  employees: ScheduleEmployee[];
  canToggleBreaks: boolean;
  onBreakToggle: (employeeId: string, breakKey: ScheduleBreakKey, checked: boolean) => void;
  show: boolean;
}) {
  const now = useClientNow();
  const reminders = useMemo(
    () => (show ? collectUpcomingBreakReminders(employees, now) : []),
    [employees, now, show],
  );

  if (reminders.length === 0) return null;

  return (
    <div className="flex min-w-[12rem] flex-1 flex-wrap items-center justify-end gap-2">
      {reminders.map((reminder) => (
        <ScheduleUpcomingBreakCard
          key={`${reminder.employeeId}-${reminder.breakKey}`}
          reminder={reminder}
          canToggleBreaks={canToggleBreaks}
          onBreakToggle={onBreakToggle}
        />
      ))}
    </div>
  );
}

function ScheduleEmployeeCard({
  employee,
  canToggleBreaks,
  onBreakToggle,
}: {
  employee: ScheduleEmployee;
  canToggleBreaks: boolean;
  onBreakToggle: (employeeId: string, breakKey: ScheduleBreakKey, checked: boolean) => void;
}) {
  return (
    <li className="rounded-lg bg-slate-100 px-3 py-3 text-sm text-slate-900 sm:hidden dark:bg-slate-700 dark:text-slate-100">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate font-medium">{employee.name}</span>
        <span className="shrink-0 text-xs opacity-80">{employee.shiftDuration}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs opacity-80">
        <span className="min-w-0 truncate">{employee.shiftTimeFrame}</span>
        <span className="min-w-0 truncate">{employee.shiftNotes || "—"}</span>
      </div>
      {employeeHasBreakSlots(employee) ? (
        <div className={`mt-2 ml-auto w-fit ${SCHEDULE_BREAK_COLS}`}>
          <ScheduleEmployeeBreaks
            employee={employee}
            canToggleBreaks={canToggleBreaks}
            onBreakToggle={onBreakToggle}
          />
        </div>
      ) : null}
    </li>
  );
}

function ScheduleEmployeeRow({
  employee,
  canToggleBreaks,
  onBreakToggle,
}: {
  employee: ScheduleEmployee;
  canToggleBreaks: boolean;
  onBreakToggle: (employeeId: string, breakKey: ScheduleBreakKey, checked: boolean) => void;
}) {
  return (
    <li
      className={`${SCHEDULE_ROW_GRID} hidden rounded-lg bg-slate-100 px-2.5 py-2.5 text-sm text-slate-900 sm:grid lg:px-4 lg:py-3 dark:bg-slate-700 dark:text-slate-100`}
    >
      <span className="min-w-0 truncate font-medium" title={employee.name}>
        {employee.name}
      </span>
      <span className="min-w-0 truncate" title={employee.shiftTimeFrame}>
        {employee.shiftTimeFrame}
      </span>
      <span className="min-w-0 truncate" title={employee.shiftDuration}>
        {employee.shiftDuration}
      </span>
      <ScheduleEmployeeBreaks
        employee={employee}
        canToggleBreaks={canToggleBreaks}
        onBreakToggle={onBreakToggle}
      />
      <span className="min-w-0 truncate opacity-80" title={employee.shiftNotes || undefined}>
        {employee.shiftNotes || "—"}
      </span>
    </li>
  );
}

export function ScheduleDayList({
  activeProfile = "FOH",
  canToggleBreaks = true,
  dateKey: dateKeyProp,
  schedule: scheduleProp,
  onScheduleUpdated,
}: Props) {
  const clientDateKey = useClientDateKey();
  const dateKey = dateKeyProp || clientDateKey;
  const isToday = Boolean(dateKey && clientDateKey && dateKey === clientDateKey);
  const [localSchedule, setLocalSchedule] = useState<ScheduleDayPayload | null>(null);
  const [refreshedSchedule, setRefreshedSchedule] = useState<ScheduleDayPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [breakSaveError, setBreakSaveError] = useState<string | null>(null);
  const [breakStateOverlay, setBreakStateOverlay] = useState<ScheduleBreakStatesByEmployee>({});

  const usingPrefetched =
    scheduleProp != null &&
    scheduleProp.date === dateKey &&
    scheduleProp.profile === activeProfile;

  const baseSchedule =
    refreshedSchedule ?? (usingPrefetched ? scheduleProp : localSchedule);

  const mergedBreakStates = useMemo(() => {
    if (!baseSchedule) return {};
    return { ...(baseSchedule.breakStates ?? {}), ...breakStateOverlay };
  }, [baseSchedule, breakStateOverlay]);

  const displaySchedule = useMemo(() => {
    if (!baseSchedule || !dateKey) return baseSchedule;
    return {
      ...baseSchedule,
      breakStates: mergedBreakStates,
      employees: applyBreakStates(baseSchedule.employees, mergedBreakStates),
    };
  }, [baseSchedule, dateKey, mergedBreakStates]);

  useEffect(() => {
    setBreakStateOverlay({});
    setBreakSaveError(null);
  }, [activeProfile, baseSchedule?.breakStates, dateKey]);

  useEffect(() => {
    setRefreshedSchedule(null);
    setRefreshError(null);
  }, [activeProfile, dateKey, scheduleProp]);

  const load = useCallback(async () => {
    if (!dateKey) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await clientApi<ScheduleDayPayload>(
        `/api/schedule?profile=${encodeURIComponent(activeProfile)}&date=${encodeURIComponent(dateKey)}`,
      );
      setLocalSchedule(data);
    } catch (error) {
      setLocalSchedule(null);
      setLoadError(error instanceof Error ? error.message : "Could not load schedule.");
    } finally {
      setLoading(false);
    }
  }, [activeProfile, dateKey]);

  const refreshSchedule = useCallback(async () => {
    if (!dateKey || refreshing) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const data = await clientApi<ScheduleDayPayload>("/api/schedule/refresh", {
        method: "POST",
        body: JSON.stringify({ profile: activeProfile, date: dateKey }),
      });
      setRefreshedSchedule(data);
      setLocalSchedule(data);
      onScheduleUpdated?.(data);
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Could not update schedule.");
    } finally {
      setRefreshing(false);
    }
  }, [activeProfile, dateKey, onScheduleUpdated, refreshing]);

  useEffect(() => {
    if (!dateKey) return;
    if (usingPrefetched) {
      setLoading(false);
      setLoadError(null);
      return;
    }
    void load();
  }, [dateKey, load, usingPrefetched]);

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

  if (!dateKey) {
    return <p className="text-sm opacity-70">Loading schedule…</p>;
  }

  const integration = displaySchedule?.integration;
  const showIntegrationError =
    integration?.state === "config_error" || integration?.state === "api_error";
  const showRefreshButton =
    isToday &&
    !loading &&
    displaySchedule != null &&
    (displaySchedule.source === "hotschedules" ||
      integration?.state === "hotschedules" ||
      integration?.state === "api_error");

  return (
    <div className="relative space-y-4 pb-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Schedule</h2>
          <p className="text-sm font-medium opacity-80">
            <span className="font-semibold text-foreground">{displaySchedule?.dayLabel ?? "—"}</span>
          </p>
        </div>
        {!loading && displaySchedule && displaySchedule.employees.length > 0 ? (
          <ScheduleUpcomingBreaks
            employees={displaySchedule.employees}
            canToggleBreaks={canToggleBreaks}
            onBreakToggle={handleBreakToggle}
            show={isToday && !showIntegrationError}
          />
        ) : null}
      </div>

      {integration ? <ScheduleIntegrationNotice integration={integration} /> : null}

      {breakSaveError ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-300/90 bg-rose-100 px-4 py-3 text-sm text-rose-950 dark:border-rose-500/50 dark:bg-rose-950/40 dark:text-rose-100"
        >
          <p className="font-semibold">Could not save break checkbox</p>
          <p className="mt-1 opacity-90">{breakSaveError}</p>
        </div>
      ) : null}

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-300/90 bg-rose-100 px-4 py-3 text-sm text-rose-950 dark:border-rose-500/50 dark:bg-rose-950/40 dark:text-rose-100"
        >
          <p className="font-semibold">Schedule request failed</p>
          <p className="mt-1 opacity-90">{loadError}</p>
        </div>
      ) : null}

      {refreshError ? (
        <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
          {refreshError}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm opacity-70">Loading employees…</p>
      ) : showIntegrationError ? null : !displaySchedule || displaySchedule.employees.length === 0 ? (
        <p className="rounded-lg bg-slate-100 p-4 text-center text-sm opacity-80 dark:bg-slate-700">
          No employees scheduled for this day.
          {displaySchedule?.integration.state === "mock" ? (
            <>
              {" "}
              Mock roster is available for{" "}
              <strong className="font-semibold">{MOCK_SCHEDULE_PROFILE_NAME}</strong>.
            </>
          ) : null}
        </p>
      ) : (
        <div className="w-full min-w-0">
          <div
            className={`${SCHEDULE_ROW_GRID} hidden px-2.5 pb-2 text-xs font-semibold uppercase tracking-wide opacity-70 sm:grid lg:px-4`}
            role="row"
          >
            <span>Name</span>
            <span>Shift</span>
            <span>Duration</span>
            <span className="text-center">30m</span>
            <span className="text-center">10m</span>
            <span className="text-center">10m</span>
            <span>Notes</span>
          </div>
          <ul className="space-y-2" role="list">
            {displaySchedule.employees.map((employee) => (
              <Fragment key={employee.id}>
                <ScheduleEmployeeCard
                  employee={employee}
                  canToggleBreaks={canToggleBreaks}
                  onBreakToggle={handleBreakToggle}
                />
                <ScheduleEmployeeRow
                  employee={employee}
                  canToggleBreaks={canToggleBreaks}
                  onBreakToggle={handleBreakToggle}
                />
              </Fragment>
            ))}
          </ul>
        </div>
      )}

      {showRefreshButton ? (
        <button
          type="button"
          className="absolute bottom-0 right-0 text-[0.6875rem] text-slate-400 underline-offset-2 transition hover:text-slate-600 hover:underline disabled:opacity-50 dark:text-slate-500 dark:hover:text-slate-300"
          disabled={refreshing}
          onClick={() => void refreshSchedule()}
          title="Pull the latest roster from HotSchedules"
        >
          {refreshing ? "Updating…" : "Update schedule"}
        </button>
      ) : null}
    </div>
  );
}
