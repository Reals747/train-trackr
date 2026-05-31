"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clientApi } from "@/lib/client-api";

/**
 * Spreadsheet-style grid for the Tasks tab. Column headers are the days Monday–Saturday
 * (Sunday excluded). Row count is a constant so it can be made adjustable later, and row
 * labels are placeholder employee names ("Name") that will become editable later.
 *
 * Cell contents are persisted per-store in the database (`/api/tasks`) so they stay in sync
 * across the Tasks tab, the expanded page, other devices, etc. The grid loads on mount and
 * polls every five seconds, matching the rest of the app's refresh model.
 *
 * When `manageMode` is on, each data cell (not the day headers or name labels) shows a pencil
 * button on its inside right. Clicking it hides that button and turns the cell into a focused,
 * multi-line editable area — no modal, edit happens directly in the cell. Saving happens when
 * the cell loses focus.
 */
export const TASK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
export const TASK_COLUMN_COUNT = TASK_DAYS.length;
export const TASK_ROW_COUNT = 5;

const POLL_INTERVAL_MS = 5000;

type ServerCell = { rowIndex: number; colIndex: number; content: string };
type EditingCell = { row: number; col: number };

function emptyGrid(): string[][] {
  return Array.from({ length: TASK_ROW_COUNT }, () =>
    Array.from({ length: TASK_COLUMN_COUNT }, () => ""),
  );
}

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

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      className={className ?? "h-4 w-4"}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
      />
    </svg>
  );
}

export function TasksGrid({
  onExpand,
  manageMode = false,
}: {
  onExpand?: () => void;
  manageMode?: boolean;
}) {
  const [cells, setCells] = useState<string[][]>(emptyGrid);
  const [editing, setEditing] = useState<EditingCell | null>(null);

  /** Kept in a ref so polling can avoid clobbering the cell the user is actively editing. */
  const editingRef = useRef<EditingCell | null>(null);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  const load = useCallback(async () => {
    try {
      const data = await clientApi<{ cells: ServerCell[] }>("/api/tasks");
      setCells((prev) =>
        Array.from({ length: TASK_ROW_COUNT }, (_, r) =>
          Array.from({ length: TASK_COLUMN_COUNT }, (_, c) => {
            const ed = editingRef.current;
            if (ed && ed.row === r && ed.col === c) return prev[r]?.[c] ?? "";
            const match = data.cells.find((x) => x.rowIndex === r && x.colIndex === c);
            return match ? match.content : "";
          }),
        ),
      );
    } catch {
      // Network/permission/migration errors are non-fatal here; the grid just keeps its current
      // values. The API returns a clear message when the table/migration is missing.
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    setCells((prev) =>
      prev.map((row, r) =>
        r === rowIndex ? row.map((cell, c) => (c === colIndex ? value : cell)) : row,
      ),
    );
  };

  const commitCell = async (rowIndex: number, colIndex: number, value: string) => {
    setEditing(null);
    try {
      await clientApi("/api/tasks", {
        method: "PUT",
        body: JSON.stringify({ rowIndex, colIndex, content: value }),
      });
    } catch {
      // Keep the typed value on screen even if the save fails; the next successful poll reconciles.
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
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-slate-200 bg-slate-100 px-3 py-2 dark:border-slate-600 dark:bg-slate-700" />
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
            {cells.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th
                  scope="row"
                  className="border border-slate-200 bg-slate-100 px-3 py-2 text-left font-medium whitespace-nowrap dark:border-slate-600 dark:bg-slate-700"
                >
                  Name
                </th>
                {row.map((value, colIndex) => {
                  const isEditing =
                    manageMode && editing?.row === rowIndex && editing?.col === colIndex;
                  return (
                    <td
                      key={colIndex}
                      className="border border-slate-200 p-0 align-top dark:border-slate-600"
                    >
                      {isEditing ? (
                        <textarea
                          autoFocus
                          value={value}
                          onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)}
                          onBlur={(e) => commitCell(rowIndex, colIndex, e.target.value)}
                          rows={2}
                          className="block w-full resize-y bg-transparent px-3 py-2 text-foreground outline-none focus:bg-slate-50 focus:ring-2 focus:ring-inset focus:ring-slate-300 dark:focus:bg-slate-800 dark:focus:ring-slate-500"
                        />
                      ) : (
                        <div className="relative min-h-[2.5rem] w-full px-3 py-2">
                          <div className="whitespace-pre-wrap break-words pr-7">{value}</div>
                          {manageMode && (
                            <button
                              type="button"
                              onClick={() => setEditing({ row: rowIndex, col: colIndex })}
                              aria-label="Edit cell"
                              title="Edit cell"
                              className="absolute right-1 top-1 inline-flex items-center justify-center rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
