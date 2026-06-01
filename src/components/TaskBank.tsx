"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { TaskPresetDto } from "@/lib/tasks";

/**
 * The store's "bank" of reusable tasks, shown below the grid in Manage mode. Each preset is a
 * draggable card (drop it on a cell to add it) and also tap-to-add into the focused cell — so it
 * works on both desktop and tablets. Managers can add, rename, and delete presets here; the bank
 * also fills itself automatically as new task text is saved in the grid.
 */
function PresetCard({
  preset,
  onTap,
  onRename,
  onDelete,
}: {
  preset: TaskPresetDto;
  onTap: (text: string) => void;
  onRename: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(preset.text);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `preset:${preset.id}`,
    data: { text: preset.text },
  });

  if (editing) {
    return (
      <li className="flex items-center gap-1 rounded-lg border border-slate-300 bg-card px-2 py-1.5 dark:border-slate-600">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const next = text.trim();
            if (next && next !== preset.text) onRename(preset.id, next);
            else setText(preset.text);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setText(preset.text);
              setEditing(false);
            }
          }}
          className="w-40 bg-transparent text-sm outline-none"
        />
      </li>
    );
  }

  return (
    <li
      ref={setNodeRef}
      className={`group flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700/60 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        onClick={() => onTap(preset.text)}
        title="Drag onto a cell, or tap to add to the selected cell"
        className="cursor-grab touch-none text-left active:cursor-grabbing"
      >
        {preset.text}
      </button>
      <span className="ml-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Rename preset"
          title="Rename"
          className="rounded p-0.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onDelete(preset.id)}
          aria-label="Delete preset"
          title="Delete"
          className="rounded p-0.5 text-slate-500 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/40 dark:hover:text-red-300"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>
    </li>
  );
}

export function TaskBank({
  presets,
  focusedCellLabel,
  onAdd,
  onTap,
  onRename,
  onDelete,
}: {
  presets: TaskPresetDto[];
  focusedCellLabel: string | null;
  onAdd: (text: string) => void;
  onTap: (text: string) => void;
  onRename: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}) {
  const [newText, setNewText] = useState("");

  const submitNew = () => {
    const text = newText.trim();
    if (!text) return;
    onAdd(text);
    setNewText("");
  };

  return (
    <section className="mt-4 rounded-xl border border-dashed border-slate-300 bg-card p-4 dark:border-slate-600">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Preset Tasks</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Drag a card onto a cell, or{" "}
            {focusedCellLabel ? (
              <>
                tap to add to <span className="font-medium">{focusedCellLabel}</span>
              </>
            ) : (
              "select a cell then tap a card to add it"
            )}
            .
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNew();
            }}
            placeholder="Add a preset task…"
            className="w-56 rounded-lg border border-slate-300 bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-600 dark:focus:ring-slate-500"
          />
          <button
            type="button"
            onClick={submitNew}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-200/90 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
          >
            Add
          </button>
        </div>
      </div>
      {presets.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No presets yet. Tasks you type into the grid are saved here automatically.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              onTap={onTap}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
