"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { clientApi } from "@/lib/client-api";
import {
  TASK_DAYS,
  encodeTaskLines,
  parseTaskLines,
  setTaskDone,
  type GridRow,
  type TaskPresetDto,
  type WeekArchiveData,
  type WeekArchiveSummary,
} from "@/lib/tasks";
import { TaskBank } from "@/components/TaskBank";

const POLL_INTERVAL_MS = 5000;

type FocusedCell = { rowId: string; colIndex: number };

/* ------------------------------------------------------------------ Autocomplete input */

function AutocompleteInput({
  value,
  presets,
  placeholder,
  autoFocus,
  onChange,
  onCommit,
  onFocus,
}: {
  value: string;
  presets: string[];
  placeholder?: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
  onFocus?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return presets
      .filter((p) => p.toLowerCase().includes(q) && p.toLowerCase() !== q)
      .slice(0, 6);
  }, [value, presets]);

  const choose = (text: string) => {
    onChange(text);
    onCommit(text);
    setOpen(false);
    setHighlight(-1);
  };

  return (
    <div className="relative min-w-0 flex-1">
      <input
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          onFocus?.();
        }}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onBlur={() => {
          // Delay so a suggestion click registers before the dropdown unmounts.
          setTimeout(() => setOpen(false), 120);
          onCommit(value);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && suggestions.length) {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp" && suggestions.length) {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (highlight >= 0 && suggestions[highlight]) choose(suggestions[highlight]);
            else {
              onCommit(value);
              setOpen(false);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
            setHighlight(-1);
          }
        }}
        className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 top-full z-20 mt-1 max-h-48 w-56 overflow-auto rounded-lg border border-slate-200 bg-card py-1 shadow-lg dark:border-slate-600">
          {suggestions.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(s)}
                className={`block w-full px-3 py-1.5 text-left text-sm ${
                  i === highlight
                    ? "bg-slate-100 dark:bg-slate-700"
                    : "hover:bg-slate-50 dark:hover:bg-slate-700/60"
                }`}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Editable cell (manage) */

function CellEditor({
  rowId,
  colIndex,
  content,
  presetTexts,
  onChangeLocal,
  onSave,
  onFocusCell,
}: {
  rowId: string;
  colIndex: number;
  content: string;
  presetTexts: string[];
  onChangeLocal: (rowId: string, colIndex: number, content: string) => void;
  onSave: (rowId: string, colIndex: number, content: string) => void;
  onFocusCell: (cell: FocusedCell) => void;
}) {
  const [addText, setAddText] = useState("");
  const tasks = parseTaskLines(content);
  const { setNodeRef, isOver } = useDroppable({ id: `cell:${rowId}:${colIndex}` });

  const writeTask = (index: number, text: string, save: boolean) => {
    const next = tasks.map((t, i) => (i === index ? { ...t, text } : t));
    const encoded = encodeTaskLines(next);
    if (save) onSave(rowId, colIndex, encoded);
    else onChangeLocal(rowId, colIndex, encoded);
  };

  const removeTask = (index: number) => {
    const encoded = encodeTaskLines(tasks.filter((_, i) => i !== index));
    onSave(rowId, colIndex, encoded);
  };

  const addTask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setAddText("");
      return;
    }
    const encoded = encodeTaskLines([...tasks, { text: trimmed, done: false }]);
    onSave(rowId, colIndex, encoded);
    setAddText("");
  };

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[2.75rem] w-full px-2 py-2 ${
        isOver ? "bg-emerald-50 ring-2 ring-inset ring-emerald-400 dark:bg-emerald-900/30" : ""
      }`}
    >
      <ul className="flex flex-col gap-1">
        {tasks.map((task, index) => (
          <li key={index} className="flex items-center gap-1">
            <AutocompleteInput
              value={task.text}
              presets={presetTexts}
              onFocus={() => onFocusCell({ rowId, colIndex })}
              onChange={(v) => writeTask(index, v, false)}
              onCommit={(v) => writeTask(index, v, true)}
            />
            <button
              type="button"
              onClick={() => removeTask(index)}
              aria-label="Remove task"
              title="Remove task"
              className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/40 dark:hover:text-red-300"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </li>
        ))}
        <li className="flex items-center gap-1 border-t border-dashed border-slate-200 pt-1 dark:border-slate-700">
          <AutocompleteInput
            value={addText}
            presets={presetTexts}
            placeholder="+ task"
            onFocus={() => onFocusCell({ rowId, colIndex })}
            onChange={setAddText}
            onCommit={addTask}
          />
        </li>
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ Past-week modal */

/* ------------------------------------------------------------------ Confirm dialog */

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  tone,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  tone: "accent" | "danger";
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200/90 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`rounded-lg px-3 py-2 text-sm font-medium text-white ${
              tone === "danger" ? "bg-red-600 hover:bg-red-700" : "btn-accent hover:opacity-90"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Past-week modal */

function PastWeekModal({
  week,
  canManage,
  onRevert,
  onDelete,
  onClose,
}: {
  week: { id: string; label: string; data: WeekArchiveData };
  canManage: boolean;
  onRevert: (id: string, label: string) => void;
  onDelete: (id: string, label: string) => void;
  onClose: () => void;
}) {
  const { days, rows } = week.data;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-5xl overflow-auto rounded-xl bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{week.label}</h2>
          <div className="flex items-center gap-2">
            {canManage && (
              <button
                type="button"
                onClick={() => onDelete(week.id, week.label)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Delete archive
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => onRevert(week.id, week.label)}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30"
              >
                Revert to this week
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium hover:bg-slate-200/90 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              Close
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-28 border border-slate-200 bg-slate-100 px-3 py-2 dark:border-slate-600 dark:bg-slate-700" />
                {days.map((day) => (
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
              {rows.map((row, r) => (
                <tr key={r}>
                  <th
                    scope="row"
                    className="w-28 border border-slate-200 bg-slate-100 px-3 py-2 text-left font-medium break-words dark:border-slate-600 dark:bg-slate-700"
                  >
                    {row.label || "—"}
                  </th>
                  {days.map((_d, c) => {
                    const tasks = parseTaskLines(row.cells[c] ?? "");
                    return (
                      <td key={c} className="border border-slate-200 p-2 align-top dark:border-slate-600">
                        <ul className="flex flex-col gap-1">
                          {tasks.map((task, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <input type="checkbox" checked={task.done} readOnly className="mt-0.5 h-4 w-4 shrink-0" />
                              <span className={task.done ? "text-slate-400 line-through" : ""}>{task.text}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Main manager */

type ActiveProfile = "FOH" | "BOH";

export function TasksManager({
  manageMode,
  activeProfile = "FOH",
}: {
  manageMode: boolean;
  activeProfile?: ActiveProfile;
}) {
  const profileQuery = `?profile=${encodeURIComponent(activeProfile)}`;
  const [rows, setRows] = useState<GridRow[]>([]);
  const [presets, setPresets] = useState<TaskPresetDto[]>([]);
  const [weeks, setWeeks] = useState<WeekArchiveSummary[]>([]);
  const [focusedCell, setFocusedCell] = useState<FocusedCell | null>(null);
  const [activeDragText, setActiveDragText] = useState<string | null>(null);
  const [openWeek, setOpenWeek] = useState<{ id: string; label: string; data: WeekArchiveData } | null>(
    null,
  );
  const [weeksOpen, setWeeksOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    tone: "accent" | "danger";
    onConfirm: () => void;
  } | null>(null);

  const presetTexts = useMemo(() => presets.map((p) => p.text), [presets]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const loadGrid = useCallback(async () => {
    try {
      const data = await clientApi<{ rows: GridRow[] }>(`/api/tasks${profileQuery}`);
      setRows(data.rows);
    } catch {
      // keep current
    }
  }, [profileQuery]);

  const loadPresets = useCallback(async () => {
    try {
      const data = await clientApi<{ presets: TaskPresetDto[] }>(
        `/api/tasks/presets${profileQuery}`,
      );
      setPresets(data.presets);
    } catch {
      // keep current
    }
  }, [profileQuery]);

  const loadWeeks = useCallback(async () => {
    try {
      const data = await clientApi<{ weeks: WeekArchiveSummary[] }>(
        `/api/tasks/weeks${profileQuery}`,
      );
      setWeeks(data.weeks);
    } catch {
      // keep current
    }
  }, [profileQuery]);

  useEffect(() => {
    void loadGrid();
    void loadPresets();
    void loadWeeks();
  }, [loadGrid, loadPresets, loadWeeks]);

  // Poll only while viewing (not managing), so a manager's in-progress edits aren't clobbered.
  useEffect(() => {
    if (manageMode) return;
    const interval = setInterval(() => void loadGrid(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [manageMode, loadGrid]);

  /* ---- cell helpers ---- */

  const setCellLocal = (rowId: string, colIndex: number, content: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, cells: { ...r.cells, [colIndex]: content } } : r,
      ),
    );
  };

  const saveCell = async (rowId: string, colIndex: number, content: string) => {
    setCellLocal(rowId, colIndex, content);
    try {
      await clientApi("/api/tasks", {
        method: "PUT",
        body: JSON.stringify({ rowId, colIndex, content }),
      });
      void loadPresets(); // bank may have gained auto-added tasks
    } catch {
      // leave optimistic value; next view-mode poll reconciles
    }
  };

  const toggleTask = async (rowId: string, colIndex: number, lineIndex: number, done: boolean) => {
    const prevContent = rows.find((r) => r.id === rowId)?.cells[colIndex] ?? "";
    setCellLocal(rowId, colIndex, setTaskDone(prevContent, lineIndex, done));
    try {
      await clientApi("/api/tasks", {
        method: "PATCH",
        body: JSON.stringify({ rowId, colIndex, lineIndex, done }),
      });
    } catch {
      setCellLocal(rowId, colIndex, prevContent);
    }
  };

  const appendToCell = (rowId: string, colIndex: number, text: string) => {
    const current = rows.find((r) => r.id === rowId)?.cells[colIndex] ?? "";
    const next = encodeTaskLines([...parseTaskLines(current), { text: text.trim(), done: false }]);
    void saveCell(rowId, colIndex, next);
  };

  /* ---- row helpers ---- */

  const addRow = async () => {
    const body: { profile: "FOH" | "BOH" } = { profile: activeProfile };
    try {
      const data = await clientApi<{ row: { id: string; label: string; order: number } }>(
        "/api/tasks/rows",
        { method: "POST", body: JSON.stringify(body) },
      );
      setRows((prev) => [...prev, { ...data.row, cells: {} }]);
    } catch {
      // ignore
    }
  };

  const renameRow = async (id: string, label: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, label } : r)));
    try {
      await clientApi("/api/tasks/rows", {
        method: "PATCH",
        body: JSON.stringify({ id, label }),
      });
    } catch {
      // ignore
    }
  };

  const moveRow = async (id: string, dir: -1 | 1) => {
    const index = rows.findIndex((r) => r.id === id);
    const target = index + dir;
    if (index < 0 || target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    try {
      await clientApi("/api/tasks/rows", {
        method: "PATCH",
        body: JSON.stringify({ orderedIds: next.map((r) => r.id) }),
      });
    } catch {
      // ignore
    }
  };

  const deleteRow = async (id: string) => {
    if (!confirm("Remove this employee row and all of its tasks?")) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    try {
      await clientApi("/api/tasks/rows", { method: "DELETE", body: JSON.stringify({ id }) });
    } catch {
      void loadGrid();
    }
  };

  /* ---- preset helpers ---- */

  const addPreset = async (text: string) => {
    const body: { text: string; profile: "FOH" | "BOH" } = { text, profile: activeProfile };
    try {
      const data = await clientApi<{ preset: TaskPresetDto }>("/api/tasks/presets", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setPresets((prev) =>
        prev.some((p) => p.id === data.preset.id) ? prev : [...prev, data.preset],
      );
    } catch {
      // ignore
    }
  };

  const renamePreset = async (id: string, text: string) => {
    setPresets((prev) => prev.map((p) => (p.id === id ? { ...p, text } : p)));
    try {
      await clientApi("/api/tasks/presets", {
        method: "PATCH",
        body: JSON.stringify({ id, text }),
      });
    } catch {
      void loadPresets();
    }
  };

  const deletePreset = async (id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
    try {
      await clientApi("/api/tasks/presets", { method: "DELETE", body: JSON.stringify({ id }) });
    } catch {
      void loadPresets();
    }
  };

  /* ---- week helpers ---- */

  const performStartNewWeek = async () => {
    setBusy(true);
    try {
      await clientApi("/api/tasks/weeks", { method: "POST", body: JSON.stringify({}) });
      await Promise.all([loadGrid(), loadWeeks()]);
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  const startNewWeek = () => {
    setConfirmDialog({
      title: "Start a new week?",
      message:
        "The current week's grid will be archived and then cleared so you can plan the new week. Employees and preset tasks are kept, and you can view or restore any archived week from Past Weeks.",
      confirmLabel: "Archive & start new week",
      tone: "accent",
      onConfirm: () => void performStartNewWeek(),
    });
  };

  const performRevert = async (weekId: string) => {
    setBusy(true);
    try {
      await clientApi(`/api/tasks/weeks/${weekId}`, { method: "POST" });
      setOpenWeek(null);
      await Promise.all([loadGrid(), loadWeeks()]);
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  const revertToWeek = (weekId: string, label: string) => {
    setConfirmDialog({
      title: "Revert to this week?",
      message: `This replaces the current grid with “${label}”. The current week's tasks and checkmarks will be deleted. To keep the current week, start a new week first (which archives it) — archived weeks are always recoverable.`,
      confirmLabel: "Revert and replace current week",
      tone: "danger",
      onConfirm: () => void performRevert(weekId),
    });
  };

  const performDeleteWeek = async (weekId: string) => {
    setBusy(true);
    try {
      await clientApi(`/api/tasks/weeks/${weekId}`, { method: "DELETE" });
      setOpenWeek(null);
      await loadWeeks();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  const deleteWeek = (weekId: string, label: string) => {
    setConfirmDialog({
      title: "Delete this archive?",
      message: `“${label}” will be permanently deleted and cannot be recovered. This does not affect the current week.`,
      confirmLabel: "Delete archive",
      tone: "danger",
      onConfirm: () => void performDeleteWeek(weekId),
    });
  };

  const openPastWeek = async (id: string, label: string) => {
    setWeeksOpen(false);
    try {
      const data = await clientApi<{ week: { label: string; data: WeekArchiveData } }>(
        `/api/tasks/weeks/${id}`,
      );
      setOpenWeek({ id, label: data.week.label || label, data: data.week.data });
    } catch {
      // ignore
    }
  };

  /* ---- drag and drop ---- */

  const onDragStart = (e: DragStartEvent) => {
    const text = (e.active.data.current as { text?: string } | undefined)?.text;
    setActiveDragText(text ?? null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveDragText(null);
    const overId = e.over?.id;
    const text = (e.active.data.current as { text?: string } | undefined)?.text;
    if (!overId || !text || typeof overId !== "string" || !overId.startsWith("cell:")) return;
    const [, rowId, colStr] = overId.split(":");
    appendToCell(rowId, Number(colStr), text);
  };

  const focusedCellLabel = useMemo(() => {
    if (!focusedCell) return null;
    const row = rows.find((r) => r.id === focusedCell.rowId);
    if (!row) return null;
    return `${row.label || "Employee"} · ${TASK_DAYS[focusedCell.colIndex]}`;
  }, [focusedCell, rows]);

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        {weeks.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setWeeksOpen((v) => !v)}
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200/90 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            >
              Past Weeks
            </button>
            {weeksOpen && (
              <ul className="absolute right-0 z-30 mt-1 max-h-72 w-64 overflow-auto rounded-lg border border-slate-200 bg-card py-1 shadow-lg dark:border-slate-600">
                {weeks.map((w) => (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => openPastWeek(w.id, w.label)}
                      className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700/60"
                    >
                      {w.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {manageMode && (
          <button
            type="button"
            onClick={startNewWeek}
            disabled={busy}
            className="btn-accent rounded-lg px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            Start New Week
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-32 border border-slate-200 bg-slate-100 px-3 py-2 dark:border-slate-600 dark:bg-slate-700" />
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
                  {manageMode ? "Add your first employee below." : "No employees yet."}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIdx) => (
                <tr key={row.id}>
                  <th
                    scope="row"
                    className="w-32 border border-slate-200 bg-slate-100 p-2 text-left align-top font-medium dark:border-slate-600 dark:bg-slate-700"
                  >
                    {manageMode ? (
                      <div className="flex flex-col gap-1">
                        <input
                          value={row.label}
                          placeholder="Employee"
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, label: e.target.value } : r,
                              ),
                            )
                          }
                          onBlur={(e) => renameRow(row.id, e.target.value.trim())}
                          className="w-full rounded border border-slate-300 bg-transparent px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-500 dark:focus:ring-slate-500"
                        />
                        <div className="flex items-center gap-1 text-slate-500">
                          <button
                            type="button"
                            onClick={() => moveRow(row.id, -1)}
                            disabled={rowIdx === 0}
                            aria-label="Move up"
                            title="Move up"
                            className="rounded p-0.5 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-600"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => moveRow(row.id, 1)}
                            disabled={rowIdx === rows.length - 1}
                            aria-label="Move down"
                            title="Move down"
                            className="rounded p-0.5 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-600"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRow(row.id)}
                            aria-label="Delete employee"
                            title="Delete employee"
                            className="ml-auto rounded p-0.5 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/40 dark:hover:text-red-300"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 7.5h12M9.75 7.5V6a1.5 1.5 0 011.5-1.5h1.5a1.5 1.5 0 011.5 1.5v1.5m-7.5 0l.75 11.25a1.5 1.5 0 001.5 1.4h4.5a1.5 1.5 0 001.5-1.4L17.25 7.5" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="break-words">{row.label || <span className="text-slate-400">—</span>}</span>
                    )}
                  </th>
                  {TASK_DAYS.map((_day, colIndex) => {
                    const content = row.cells[colIndex] ?? "";
                    return (
                      <td
                        key={colIndex}
                        className="border border-slate-200 p-0 align-top dark:border-slate-600"
                      >
                        {manageMode ? (
                          <CellEditor
                            rowId={row.id}
                            colIndex={colIndex}
                            content={content}
                            presetTexts={presetTexts}
                            onChangeLocal={setCellLocal}
                            onSave={saveCell}
                            onFocusCell={setFocusedCell}
                          />
                        ) : (
                          <div className="min-h-[2.5rem] w-full px-3 py-2">
                            <ul className="flex flex-col gap-1">
                              {parseTaskLines(content).map((task, lineIndex) => (
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
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {manageMode && (
        <div className="mt-3">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200/90 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
          >
            + Add employee
          </button>
        </div>
      )}

      {manageMode && (
        <TaskBank
          presets={presets}
          focusedCellLabel={focusedCellLabel}
          onAdd={addPreset}
          onTap={(text) => {
            if (focusedCell) appendToCell(focusedCell.rowId, focusedCell.colIndex, text);
          }}
          onRename={renamePreset}
          onDelete={deletePreset}
        />
      )}

      <DragOverlay>
        {activeDragText ? (
          <div className="rounded-lg border border-slate-300 bg-card px-2 py-1.5 text-sm shadow-lg dark:border-slate-500">
            {activeDragText}
          </div>
        ) : null}
      </DragOverlay>

      {openWeek && (
        <PastWeekModal
          week={openWeek}
          canManage={manageMode}
          onRevert={revertToWeek}
          onDelete={deleteWeek}
          onClose={() => setOpenWeek(null)}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          tone={confirmDialog.tone}
          onConfirm={confirmDialog.onConfirm}
          onClose={() => setConfirmDialog(null)}
        />
      )}
    </DndContext>
  );
}
