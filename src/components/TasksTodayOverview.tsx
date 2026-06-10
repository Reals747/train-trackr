"use client";

import { useCallback, useEffect, useState } from "react";
import { clientApi } from "@/lib/client-api";
import { TASK_DAYS, type GridRow, parseTaskLines, setTaskDone } from "@/lib/tasks";

/**
 * Compact dashboard widget showing only *today's* tasks for each employee.
 * It maps the current weekday onto the Tasks grid columns (Monday–Saturday)
 * and renders just that column; the full Mon–Sat grid lives on the Tasks tab.
 * Shares the `/api/tasks` data + cell format with {@link TasksGrid}, so toggling
 * a task here persists store-wide just the same.
 */
const POLL_INTERVAL_MS = 5000;

/** JS `Date.getDay()` is 0=Sunday..6=Saturday; TASK_DAYS is 0=Monday..5=Saturday. */
function weekdayToColumnIndex(jsDay: number): number {
  return jsDay - 1;
}

type ActiveProfile = "FOH" | "BOH";

export function TasksTodayOverview({ activeProfile = "FOH" }: { activeProfile?: ActiveProfile }) {
  const [rows, setRows] = useState<GridRow[]>([]);
  /** null until resolved on the client (avoids SSR/client hydration mismatch on the date). */
  const [todayColIndex, setTodayColIndex] = useState<number | null>(null);

  useEffect(() => {
    setTodayColIndex(weekdayToColumnIndex(new Date().getDay()));
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await clientApi<{ rows: GridRow[] }>(
        `/api/tasks?profile=${encodeURIComponent(activeProfile)}`,
      );
      setRows(data.rows);
    } catch {
      // Non-fatal; keep showing whatever we have.
    }
  }, [activeProfile]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const toggleTask = async (rowId: string, lineIndex: number, done: boolean) => {
    if (todayColIndex === null || todayColIndex < 0) return;
    const colIndex = todayColIndex;
    const prevContent = rows.find((r) => r.id === rowId)?.cells[colIndex] ?? "";
    const next = setTaskDone(prevContent, lineIndex, done);
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, cells: { ...r.cells, [colIndex]: next } } : r,
      ),
    );
    try {
      await clientApi("/api/tasks", {
        method: "PATCH",
        body: JSON.stringify({ rowId, colIndex, lineIndex, done }),
      });
    } catch {
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId ? { ...r, cells: { ...r.cells, [colIndex]: prevContent } } : r,
        ),
      );
    }
  };

  if (todayColIndex === null) {
    return <p className="text-sm opacity-70">Loading today&apos;s tasks…</p>;
  }

  if (todayColIndex < 0) {
    return (
      <p className="text-sm opacity-70">
        No tasks are scheduled on Sundays. Check back Monday, or open the Tasks tab for the full week.
      </p>
    );
  }

  const dayName = TASK_DAYS[todayColIndex];
  const todays = rows
    .map((row) => ({ row, tasks: parseTaskLines(row.cells[todayColIndex] ?? "") }))
    .filter((entry) => entry.tasks.length > 0);

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium opacity-80">
        Today · <span className="font-semibold text-foreground">{dayName}</span>
      </p>
      {todays.length === 0 ? (
        <p className="rounded-lg bg-slate-100 p-4 text-center text-sm opacity-80 dark:bg-slate-700">
          No tasks for {dayName}.
        </p>
      ) : (
        <ul className="space-y-3">
          {todays.map(({ row, tasks }) => (
              <li
                key={row.id}
                className="w-full rounded-lg bg-slate-100 p-3 text-left text-sm font-medium text-slate-900 dark:bg-slate-700 dark:text-slate-100"
              >
                <p className="font-semibold">{row.label || "—"}</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {tasks.map((task, lineIndex) => (
                    <li key={lineIndex} className="flex items-start gap-2 text-sm font-normal">
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={(e) => toggleTask(row.id, lineIndex, e.target.checked)}
                        aria-label={`Mark "${task.text}" ${task.done ? "not done" : "done"}`}
                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-slate-600 dark:accent-slate-300"
                      />
                      <span
                        className={`min-w-0 break-words ${
                          task.done ? "text-slate-400 line-through dark:text-slate-500" : ""
                        }`}
                      >
                        {task.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
          ))}
        </ul>
      )}
    </div>
  );
}
