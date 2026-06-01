import { prisma } from "@/lib/prisma";
import {
  TASK_DAYS,
  type GridRow,
  type WeekArchiveData,
  parseTaskLines,
} from "@/lib/tasks";

/** Load the live grid (rows + their day cells) for a store, ordered for display. */
export async function loadGrid(storeId: string): Promise<GridRow[]> {
  const rows = await prisma.taskRow.findMany({
    where: { storeId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      label: true,
      order: true,
      cells: { select: { colIndex: true, content: true } },
    },
  });

  return rows.map((row) => {
    const cells: Record<number, string> = {};
    for (const cell of row.cells) {
      if (cell.content) cells[cell.colIndex] = cell.content;
    }
    return { id: row.id, label: row.label, order: row.order, cells };
  });
}

/** Confirm a row id belongs to the given store (guards cross-store writes). */
export async function rowBelongsToStore(rowId: string, storeId: string): Promise<boolean> {
  const row = await prisma.taskRow.findUnique({ where: { id: rowId }, select: { storeId: true } });
  return row?.storeId === storeId;
}

/**
 * Bank any task text found in `content` that isn't already a preset for this store.
 * Appended after existing presets. Best-effort: never throws into the caller's flow.
 */
export async function addPresetsFromContent(storeId: string, content: string): Promise<void> {
  const texts = Array.from(new Set(parseTaskLines(content).map((task) => task.text))).filter(
    (text) => text.length > 0,
  );
  if (texts.length === 0) return;

  try {
    const existing = await prisma.taskPreset.findMany({
      where: { storeId, text: { in: texts } },
      select: { text: true },
    });
    const have = new Set(existing.map((preset) => preset.text));
    const toAdd = texts.filter((text) => !have.has(text));
    if (toAdd.length === 0) return;

    const max = await prisma.taskPreset.aggregate({
      where: { storeId },
      _max: { order: true },
    });
    let order = (max._max.order ?? -1) + 1;

    await prisma.taskPreset.createMany({
      data: toAdd.map((text) => ({ storeId, text, order: order++ })),
      skipDuplicates: true,
    });
  } catch {
    // Banking presets is a convenience; a failure here must not block saving the cell.
  }
}

/** Build the immutable snapshot stored when a week is archived. */
export async function buildArchiveData(storeId: string): Promise<WeekArchiveData> {
  const rows = await loadGrid(storeId);
  return {
    days: [...TASK_DAYS],
    rows: rows.map((row) => ({ label: row.label, cells: row.cells })),
  };
}
