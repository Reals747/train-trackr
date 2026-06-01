/**
 * Helpers for the Tasks grid cell format.
 *
 * A cell's `content` string holds one task per line. Each line may carry a
 * checkbox marker so completion state can be persisted inside the same string
 * (no schema change needed):
 *
 *   "[x] mop the floor"   -> done
 *   "[ ] restock cups"    -> not done
 *   "wipe counters"       -> not done (legacy plain text, still supported)
 *
 * Blank lines are ignored so the visible checkbox list stays in sync between
 * the client and the server (toggles address a task by its index in this list).
 */
export type TaskLine = { text: string; done: boolean };

/** Column headers for the Tasks grid. Sunday is intentionally excluded. */
export const TASK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
export const TASK_COLUMN_COUNT = TASK_DAYS.length;

/** A row (employee) with its day cells, as returned by `GET /api/tasks`. */
export type GridRow = {
  id: string;
  label: string;
  order: number;
  /** Keyed by colIndex (0..5). Sparse: only non-empty cells are present. */
  cells: Record<number, string>;
};

export type TaskPresetDto = { id: string; text: string; order: number };

export type WeekArchiveSummary = { id: string; label: string; archivedAt: string };

/** Read-only snapshot stored in `TaskWeekArchive.data`. */
export type WeekArchiveData = {
  days: string[];
  rows: { label: string; cells: Record<number, string> }[];
};

const MARKER_RE = /^\[([ xX])\]\s?(.*)$/;

export function parseTaskLines(content: string): TaskLine[] {
  if (!content) return [];
  return content
    .split("\n")
    .map((line) => {
      const match = MARKER_RE.exec(line);
      if (match) {
        return { text: match[2].trim(), done: match[1] === "x" || match[1] === "X" };
      }
      return { text: line.trim(), done: false };
    })
    .filter((task) => task.text.length > 0);
}

export function encodeTaskLines(tasks: TaskLine[]): string {
  return tasks
    .filter((task) => task.text.trim().length > 0)
    .map((task) => `${task.done ? "[x]" : "[ ]"} ${task.text.trim()}`)
    .join("\n");
}

/** Flip a single task's done state, addressed by its index in {@link parseTaskLines}. */
export function setTaskDone(content: string, lineIndex: number, done: boolean): string {
  const tasks = parseTaskLines(content);
  if (lineIndex < 0 || lineIndex >= tasks.length) return content;
  tasks[lineIndex] = { ...tasks[lineIndex], done };
  return encodeTaskLines(tasks);
}

/** Plain text (one task per line, no markers) for editing a cell in a textarea. */
export function toEditText(content: string): string {
  return parseTaskLines(content)
    .map((task) => task.text)
    .join("\n");
}

/**
 * Turn edited textarea text back into stored content, preserving the done state
 * of tasks whose text is unchanged (matched by text, so reordering is fine).
 * New or renamed tasks default to not done.
 */
export function reconcileEdit(draft: string, previousContent: string): string {
  const doneCounts = new Map<string, number>();
  for (const task of parseTaskLines(previousContent)) {
    if (task.done) doneCounts.set(task.text, (doneCounts.get(task.text) ?? 0) + 1);
  }

  const tasks: TaskLine[] = draft
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((text) => {
      const remaining = doneCounts.get(text) ?? 0;
      if (remaining > 0) {
        doneCounts.set(text, remaining - 1);
        return { text, done: true };
      }
      return { text, done: false };
    });

  return encodeTaskLines(tasks);
}
