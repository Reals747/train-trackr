"use client";

import { useCallback, useEffect, useState } from "react";
import { clientApi } from "@/lib/client-api";
import {
  mergeScheduleBreakState,
  readScheduleBreakState,
  writeScheduleBreakState,
  type ScheduleBreakKey,
} from "@/lib/schedule-breaks-storage";
import {
  toDateKey,
  type ScheduleDayPayload,
  type ScheduleEmployee,
} from "@/lib/schedule";
import { MOCK_SCHEDULE_PROFILE_NAME } from "@/lib/schedule";

type Props = {
  activeProfile?: string;
  canToggleBreaks?: boolean;
};

const SCHEDULE_ROW_GRID =
  "grid grid-cols-[minmax(6.5rem,1.15fr)_minmax(7.5rem,1fr)_minmax(4.5rem,0.65fr)_2.75rem_2.75rem_2.75rem_minmax(5rem,0.9fr)] items-center gap-x-3 gap-y-1";

function applyStoredBreaks(
  profile: string,
  dateKey: string,
  employees: ScheduleEmployee[],
): ScheduleEmployee[] {
  return employees.map((employee) => ({
    ...employee,
    ...mergeScheduleBreakState(profile, dateKey, employee),
  }));
}

function ScheduleBreakCell({
  value,
  label,
  canToggle,
  onToggle,
}: {
  value: boolean | undefined;
  label: string;
  canToggle: boolean;
  onToggle: (checked: boolean) => void;
}) {
  if (value === undefined) return <span aria-hidden />;
  return (
    <span className="flex justify-center">
      <input
        type="checkbox"
        checked={value}
        disabled={!canToggle}
        onChange={(event) => onToggle(event.target.checked)}
        aria-label={label}
        className="h-4 w-4 accent-slate-600 disabled:cursor-not-allowed disabled:opacity-60 dark:accent-slate-300"
      />
    </span>
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
      className={`${SCHEDULE_ROW_GRID} rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-900 dark:bg-slate-700 dark:text-slate-100`}
    >
      <span className="min-w-0 truncate font-medium">{employee.name}</span>
      <span className="min-w-0 whitespace-nowrap">{employee.shiftTimeFrame}</span>
      <span className="min-w-0 whitespace-nowrap">{employee.shiftDuration}</span>
      <ScheduleBreakCell
        value={employee.break30Min}
        label={`30 minute break for ${employee.name}`}
        canToggle={canToggleBreaks}
        onToggle={(checked) => onBreakToggle(employee.id, "break30Min", checked)}
      />
      <ScheduleBreakCell
        value={employee.break10MinFirst}
        label={`First 10 minute break for ${employee.name}`}
        canToggle={canToggleBreaks}
        onToggle={(checked) => onBreakToggle(employee.id, "break10MinFirst", checked)}
      />
      <ScheduleBreakCell
        value={employee.break10MinSecond}
        label={`Second 10 minute break for ${employee.name}`}
        canToggle={canToggleBreaks}
        onToggle={(checked) => onBreakToggle(employee.id, "break10MinSecond", checked)}
      />
      <span className="min-w-0 truncate opacity-80">{employee.shiftNotes || "—"}</span>
    </li>
  );
}

export function ScheduleDayList({ activeProfile = "FOH", canToggleBreaks = true }: Props) {
  const [todayDateKey, setTodayDateKey] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleDayPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTodayDateKey(toDateKey(new Date()));
  }, []);

  const load = useCallback(async () => {
    if (!todayDateKey) return;
    setLoading(true);
    try {
      const data = await clientApi<ScheduleDayPayload>(
        `/api/schedule?profile=${encodeURIComponent(activeProfile)}&date=${encodeURIComponent(todayDateKey)}`,
      );
      setSchedule({
        ...data,
        employees: applyStoredBreaks(activeProfile, todayDateKey, data.employees),
      });
    } catch {
      setSchedule(null);
    } finally {
      setLoading(false);
    }
  }, [activeProfile, todayDateKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleBreakToggle = useCallback(
    (employeeId: string, breakKey: ScheduleBreakKey, checked: boolean) => {
      if (!todayDateKey || !canToggleBreaks) return;

      setSchedule((current) => {
        if (!current) return current;

        const employees = current.employees.map((employee) => {
          if (employee.id !== employeeId) return employee;
          if (employee[breakKey] === undefined) return employee;
          return { ...employee, [breakKey]: checked };
        });

        const updated = employees.find((employee) => employee.id === employeeId);
        if (updated) {
          const stored = readScheduleBreakState(activeProfile, todayDateKey, employeeId);
          writeScheduleBreakState(activeProfile, todayDateKey, employeeId, {
            ...stored,
            ...(updated.break30Min !== undefined ? { break30Min: updated.break30Min } : {}),
            ...(updated.break10MinFirst !== undefined
              ? { break10MinFirst: updated.break10MinFirst }
              : {}),
            ...(updated.break10MinSecond !== undefined
              ? { break10MinSecond: updated.break10MinSecond }
              : {}),
          });
        }

        return { ...current, employees };
      });
    },
    [activeProfile, canToggleBreaks, todayDateKey],
  );

  if (todayDateKey === null) {
    return <p className="text-sm opacity-70">Loading schedule…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium opacity-80">
        <span className="font-semibold text-foreground">{schedule?.dayLabel ?? "—"}</span>
      </p>

      {loading ? (
        <p className="text-sm opacity-70">Loading employees…</p>
      ) : !schedule || schedule.employees.length === 0 ? (
        <p className="rounded-lg bg-slate-100 p-4 text-center text-sm opacity-80 dark:bg-slate-700">
          No employees scheduled for this day. Schedule data is not set up for this profile yet
          {schedule?.source === "mock" ? (
            <>
              {" "}
              (mock roster is available for <strong className="font-semibold">{MOCK_SCHEDULE_PROFILE_NAME}</strong>)
            </>
          ) : null}
          .
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[52rem]">
            <div
              className={`${SCHEDULE_ROW_GRID} px-4 pb-2 text-xs font-semibold uppercase tracking-wide opacity-70`}
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
              {schedule.employees.map((employee) => (
                <ScheduleEmployeeRow
                  key={employee.id}
                  employee={employee}
                  canToggleBreaks={canToggleBreaks}
                  onBreakToggle={handleBreakToggle}
                />
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
