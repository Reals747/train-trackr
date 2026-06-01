"use client";

import { useCallback, useEffect, useState } from "react";
import { clientApi } from "@/lib/client-api";
import { TASK_DAYS, type GridRow, parseTaskLines, setTaskDone } from "@/lib/tasks";

/**
 * Read-only Tasks grid used inside the embedded Tasks tab. Columns are Monday–Saturday; rows are
 * the store's employees. Each cell holds one task per line, rendered with a checkbox; checking a
 * task off persists for everyone (the `/api/tasks` PATCH route). Loads on mount and polls every
 * five seconds. Managing rows, the preset bank, and weekly archives lives on the full page
 * (`TasksManager`); use the Expand button to get there.
 */
const POLL_INTERVAL_MS = 5000;

function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      className={className ?? "h-5 w-5"}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M20.25 20.25v-4.5m0 4.5h-4.5m4.5 0L15 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9M3.75 20.25h4.5m-4.5 0v-4.5m0 4.5L9 15"
      />
    </svg>
  );
}

export function TasksGrid({ onExpand }: { onExpand?: () => void }) {
  const [rows, setRows] = useState<GridRow[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await clientApi<{ rows: GridRow[] }>("/api/tasks");
      setRows(data.rows);
    } catch {
      // Non-fatal; keep showing whatever we have. The API returns a clear message on setup issues.
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const toggleTask = async (
    rowId: string,
    colIndex: number,
    lineIndex: number,
    done: boolean,
  ) => {
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

  return (
    <div className="mt-4">
      {onExpand && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={onExpand}
            aria-label="Open tasks in full page"
            title="Open in full page"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200/90 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
          >
            <ExpandIcon className="h-4 w-4" />
            Expand
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-28 border border-slate-200 bg-slate-100 px-3 py-2 dark:border-slate-600 dark:bg-slate-700" />
              {TASK_DAYS.map((day) => (
                <th
                  key={day}
                  className="border border-slate-200 bg-slate-100 px-3 py-2 text-center font-semibold dark:border-slate-600 dark:bg-slate-700"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={TASK_DAYS.length + 1}
                  className="border border-slate-200 px-3 py-6 text-center text-slate-500 dark:border-slate-600 dark:text-slate-400"
                >
                  No employees yet. Open the full page to manage tasks.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <th
                    scope="row"
                    className="w-28 border border-slate-200 bg-slate-100 px-3 py-2 text-left font-medium break-words dark:border-slate-600 dark:bg-slate-700"
                  >
                    {row.label || <span className="text-slate-400">—</span>}
                  </th>
                  {TASK_DAYS.map((_day, colIndex) => {
                    const tasks = parseTaskLines(row.cells[colIndex] ?? "");
                    return (
                      <td
                        key={colIndex}
                        className="border border-slate-200 p-0 align-top dark:border-slate-600"
                      >
                        <div className="min-h-[2.5rem] w-full px-3 py-2">
                          {tasks.length > 0 ? (
                            <ul className="flex flex-col gap-1">
                              {tasks.map((task, lineIndex) => (
                                <li key={lineIndex} className="flex items-start gap-2">
                                  <input
                                    type="checkbox"
                                    checked={task.done}
                                    onChange={(e) =>
                                      toggleTask(row.id, colIndex, lineIndex, e.target.checked)
                                    }
                                    aria-label={`Mark "${task.text}" ${task.done ? "not done" : "done"}`}
                                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-slate-600 dark:accent-slate-300"
                                  />
                                  <span
                                    className={`min-w-0 break-words ${
                                      task.done
                                        ? "text-slate-400 line-through dark:text-slate-500"
                                        : ""
                                    }`}
                                  >
                                    {task.text}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">&nbsp;</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
