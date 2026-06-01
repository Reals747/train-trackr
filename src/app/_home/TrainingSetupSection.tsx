"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "./api";
import {
  ChevronDisclosureIcon,
  DragHandleIcon,
  EllipsisHorizontalIcon,
  PencilIcon,
  TrashIcon,
} from "./icons";
import type { ChecklistKind, Position } from "./types";

/** Positions and checklists — Settings → Training Setup (managers only). */
export function TrainingSetupSection({
  positions,
  setPositions,
  onRefresh,
}: {
  positions: Position[];
  setPositions: Dispatch<SetStateAction<Position[]>>;
  onRefresh: () => Promise<void>;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createErr, setCreateErr] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  const sorted = useMemo(() => {
    return [...positions].sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.name.localeCompare(b.name);
    });
  }, [positions]);
  const sortedIds = useMemo(() => sorted.map((p) => p.id), [sorted]);

  /** PointerSensor activation distance lets normal click-to-expand still work without immediately starting a drag. */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handlePositionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedIds.indexOf(String(active.id));
    const newIndex = sortedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(sorted, oldIndex, newIndex);

    // Optimistic: rewrite local order indexes immediately so the list reflects the drag.
    const previous = positions;
    setPositions((prev) => {
      const orderMap = new Map(reordered.map((p, i) => [p.id, i] as const));
      return prev.map((p) =>
        orderMap.has(p.id) ? { ...p, order: orderMap.get(p.id) ?? p.order } : p,
      );
    });

    api("/api/positions/reorder", {
      method: "POST",
      body: JSON.stringify({ orderedIds: reordered.map((p) => p.id) }),
    }).catch(() => {
      // Roll back to previous order on failure.
      setPositions(previous);
    });
  }

  useEffect(() => {
    if (!createOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCreateOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createOpen]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm opacity-80">
          Expand a position to view checklist items. Hidden positions stay in this list for you but are
          hidden from trainers until restored.
        </p>
        <button
          type="button"
          className="btn-accent shrink-0 rounded-lg px-4 py-2 font-medium"
          onClick={() => {
            setCreateName("");
            setCreateErr("");
            setCreateOpen(true);
          }}
        >
          Create Position
        </button>
      </div>

      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-position-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setCreateOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border bg-card p-5 shadow-lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="create-position-title" className="mb-3 text-lg font-semibold">
              New position
            </h3>
            <label className="mb-1 block text-sm font-medium">Position name</label>
            <input
              autoFocus
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. Front Counter"
              className="mb-3 w-full rounded-lg border bg-background p-3"
            />
            {createErr && <p className="mb-3 text-sm text-rose-600">{createErr}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border px-4 py-2 text-sm font-medium"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-accent rounded-lg px-4 py-2 text-sm font-medium"
                disabled={createSaving}
                onClick={async () => {
                  const name = createName.trim();
                  if (name.length < 2) {
                    setCreateErr("Enter at least 2 characters.");
                    return;
                  }
                  setCreateErr("");
                  setCreateSaving(true);
                  try {
                    await api("/api/positions", {
                      method: "POST",
                      body: JSON.stringify({ name }),
                    });
                    setCreateOpen(false);
                    setCreateName("");
                    await onRefresh();
                  } catch (e) {
                    setCreateErr((e as Error).message);
                  } finally {
                    setCreateSaving(false);
                  }
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handlePositionDragEnd}
      >
        <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {sorted.length === 0 && (
              <p className="rounded-lg bg-slate-100 p-6 text-center text-sm opacity-80 dark:bg-slate-700">
                No positions yet. Use Create Position to add one.
              </p>
            )}
            {sorted.map((position) => (
              <PositionTrainingRow
                key={position.id}
                position={position}
                setPositions={setPositions}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function PositionTrainingRow({
  position,
  setPositions,
  onRefresh,
}: {
  position: Position;
  setPositions: Dispatch<SetStateAction<Position[]>>;
  onRefresh: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [itemText, setItemText] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemErr, setItemErr] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState(position.name);
  const [renameErr, setRenameErr] = useState("");
  const [editingItem, setEditingItem] = useState<
    { id: string; text: string; description: string; kind: ChecklistKind } | null
  >(null);
  const [editItemErr, setEditItemErr] = useState("");
  const [addHeaderOpen, setAddHeaderOpen] = useState(false);
  const [addHeaderText, setAddHeaderText] = useState("");
  const [addHeaderErr, setAddHeaderErr] = useState("");
  const [addChecklistItemOpen, setAddChecklistItemOpen] = useState(false);

  /** Drag-and-drop wiring: this row is itself a sortable position; items inside use a nested DndContext. */
  const {
    setNodeRef: setPositionNodeRef,
    attributes: positionDragAttributes,
    listeners: positionDragListeners,
    transform: positionTransform,
    transition: positionTransition,
    isDragging: isPositionDragging,
  } = useSortable({ id: position.id });
  const positionStyle = {
    transform: CSS.Transform.toString(positionTransform),
    transition: positionTransition,
    opacity: isPositionDragging ? 0.6 : 1,
  };
  const itemIds = useMemo(() => position.items.map((it) => it.id), [position.items]);
  const itemSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = itemIds.indexOf(String(active.id));
    const newIndex = itemIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(position.items, oldIndex, newIndex);
    const previous = position.items;
    setPositions((prev) =>
      prev.map((p) => (p.id === position.id ? { ...p, items: reordered } : p)),
    );
    api(`/api/positions/${position.id}/items/reorder`, {
      method: "POST",
      body: JSON.stringify({ orderedIds: reordered.map((it) => it.id) }),
    }).catch((err) => {
      setPositions((prev) =>
        prev.map((p) => (p.id === position.id ? { ...p, items: previous } : p)),
      );
      setActionErr(`Reorder failed: ${(err as Error).message}`);
    });
  }

  useEffect(() => {
    if (!menuOpen) return;
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  useEffect(() => {
    if (!renameOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRenameOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [renameOpen]);

  useEffect(() => {
    if (!editingItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditingItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingItem]);

  useEffect(() => {
    if (!addHeaderOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAddHeaderOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addHeaderOpen]);

  useEffect(() => {
    if (!addChecklistItemOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAddChecklistItemOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addChecklistItemOpen]);

  return (
    <div
      ref={setPositionNodeRef}
      style={positionStyle}
      className={`rounded-lg text-left text-sm bg-slate-100 dark:bg-slate-700 ${
        position.hidden ? "text-foreground/80 dark:text-foreground/80" : ""
      } ${menuOpen ? "relative z-50" : ""}`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          aria-label={`Drag position ${position.name}`}
          title="Drag to reorder"
          className="shrink-0 cursor-grab touch-none rounded p-1 text-slate-400 hover:text-slate-700 active:cursor-grabbing dark:text-slate-500 dark:hover:text-slate-200"
          {...positionDragAttributes}
          {...positionDragListeners}
        >
          <DragHandleIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left font-medium"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <ChevronDisclosureIcon expanded={expanded} />
          <span className="truncate">{position.name}</span>
          {position.hidden && (
            <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-xs dark:bg-slate-600">
              Hidden
            </span>
          )}
        </button>
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-600/70 dark:hover:text-slate-100"
            aria-label="Position options"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
          >
            <EllipsisHorizontalIcon className="h-5 w-5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-[100] mt-1 min-w-[11rem] rounded-lg border bg-card py-1 shadow-lg">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  setActionErr("");
                  setRenameName(position.name);
                  setRenameErr("");
                  setRenameOpen(true);
                }}
              >
                Edit position name
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  setActionErr("");
                  const nextHidden = !position.hidden;
                  setPositions((prev) =>
                    prev.map((p) =>
                      p.id === position.id ? { ...p, hidden: nextHidden } : p,
                    ),
                  );
                  api(`/api/positions/${position.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ hidden: nextHidden }),
                  }).catch((err) => {
                    setPositions((prev) =>
                      prev.map((p) =>
                        p.id === position.id ? { ...p, hidden: !nextHidden } : p,
                      ),
                    );
                    setActionErr(`Update failed: ${(err as Error).message}`);
                  });
                }}
              >
                {position.hidden ? "Show position" : "Hide position"}
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  setActionErr("");
                  if (
                    !window.confirm(
                      `Delete position "${position.name}" and all of its checklist items? This cannot be undone.`,
                    )
                  ) {
                    return;
                  }
                  const previousPosition = position;
                  setPositions((prev) => prev.filter((p) => p.id !== position.id));
                  api(`/api/positions/${position.id}`, { method: "DELETE" }).catch((err) => {
                    setPositions((prev) =>
                      prev.some((p) => p.id === previousPosition.id)
                        ? prev
                        : [...prev, previousPosition],
                    );
                    setActionErr(`Delete failed: ${(err as Error).message}`);
                  });
                }}
              >
                Delete position
              </button>
            </div>
          )}
        </div>
      </div>
      {actionErr && <p className="px-3 pb-2 text-xs text-rose-600">{actionErr}</p>}

      {expanded && (
        <div className="space-y-3 border-t border-slate-200 px-3 py-3 dark:border-slate-600">
          {position.items.length === 0 ? (
            <p className="text-xs opacity-70">No checklist items yet.</p>
          ) : (
            <DndContext
              sensors={itemSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleItemDragEnd}
            >
              <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                <ul className="space-y-2">
                  {position.items.map((item) => (
                    <SortableChecklistItemRow
                      key={item.id}
                      item={item}
                      onEdit={() => {
                        setActionErr("");
                        setEditItemErr("");
                        setEditingItem({
                          id: item.id,
                          text: item.text,
                          description: item.description ?? "",
                          kind: item.kind,
                        });
                      }}
                      onDelete={() => {
                        const label =
                          item.kind === "header" ? "Remove this section header?" : "Remove this checklist item?";
                        if (!window.confirm(label)) return;
                        const previousItems = position.items;
                        setActionErr("");
                        setPositions((prev) =>
                          prev.map((p) =>
                            p.id === position.id
                              ? { ...p, items: p.items.filter((it) => it.id !== item.id) }
                              : p,
                          ),
                        );
                        api(`/api/checklist-items/${item.id}`, { method: "DELETE" }).catch(
                          (err) => {
                            setPositions((prev) =>
                              prev.map((p) =>
                                p.id === position.id ? { ...p, items: previousItems } : p,
                              ),
                            );
                            setActionErr(`Delete failed: ${(err as Error).message}`);
                          },
                        );
                      }}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              onClick={() => {
                setAddHeaderText("");
                setAddHeaderErr("");
                setAddHeaderOpen(true);
              }}
            >
              + Add section header
            </button>
            <button
              type="button"
              className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              onClick={() => {
                setItemText("");
                setItemDesc("");
                setItemErr("");
                setAddChecklistItemOpen(true);
              }}
            >
              + Add checklist item
            </button>
          </div>
        </div>
      )}
      {renameOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`edit-position-title-${position.id}`}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setRenameOpen(false);
              }
            }}
          >
            <form
              className="w-full max-w-md rounded-xl border bg-card p-5 shadow-lg"
              onMouseDown={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                const name = renameName.trim();
                if (name.length < 2) {
                  setRenameErr("Enter at least 2 characters.");
                  return;
                }
                if (name === position.name) {
                  setRenameOpen(false);
                  return;
                }
                const previousName = position.name;
                setRenameErr("");
                setRenameOpen(false);
                setPositions((prev) =>
                  prev.map((p) => (p.id === position.id ? { ...p, name } : p)),
                );
                api(`/api/positions/${position.id}`, {
                  method: "PUT",
                  body: JSON.stringify({ name }),
                }).catch((err) => {
                  setPositions((prev) =>
                    prev.map((p) => (p.id === position.id ? { ...p, name: previousName } : p)),
                  );
                  setActionErr(`Rename failed: ${(err as Error).message}`);
                });
              }}
            >
              <h3 id={`edit-position-title-${position.id}`} className="mb-3 text-lg font-semibold">
                Edit position name
              </h3>
              <label className="mb-1 block text-sm font-medium">Position name</label>
              <input
                autoFocus
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                placeholder="e.g. Front Counter"
                className="mb-3 w-full rounded-lg border bg-background p-3"
              />
              {renameErr && <p className="mb-3 text-sm text-rose-600">{renameErr}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setRenameOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-accent rounded-lg px-4 py-2 text-sm font-medium"
                >
                  Continue
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
      {editingItem &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`edit-checklist-item-title-${position.id}`}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setEditingItem(null);
              }
            }}
          >
            <form
              className="w-full max-w-md rounded-xl border bg-card p-5 shadow-lg"
              onMouseDown={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                if (!editingItem) return;
                const text = editingItem.text.trim();
                const description = editingItem.description.trim();
                const editingKind = editingItem.kind;
                if (text.length < 1) {
                  setEditItemErr(
                    editingKind === "header"
                      ? "Header text is required."
                      : "Checklist text is required.",
                  );
                  return;
                }
                const itemId = editingItem.id;
                const previous = position.items.find((it) => it.id === itemId);
                if (!previous) {
                  setEditItemErr("Item not found.");
                  return;
                }
                setEditItemErr("");
                setEditingItem(null);
                setPositions((prev) =>
                  prev.map((p) =>
                    p.id === position.id
                      ? {
                          ...p,
                          items: p.items.map((it) =>
                            it.id === itemId
                              ? {
                                  ...it,
                                  text,
                                  description:
                                    editingKind === "header" ? null : description || null,
                                }
                              : it,
                          ),
                        }
                      : p,
                  ),
                );
                api(`/api/checklist-items/${itemId}`, {
                  method: "PUT",
                  body: JSON.stringify({
                    text,
                    description: editingKind === "header" ? undefined : description || undefined,
                    kind: editingKind,
                  }),
                }).catch((err) => {
                  setPositions((prev) =>
                    prev.map((p) =>
                      p.id === position.id
                        ? {
                            ...p,
                            items: p.items.map((it) =>
                              it.id === itemId
                                ? { ...it, text: previous.text, description: previous.description }
                                : it,
                            ),
                          }
                        : p,
                    ),
                  );
                  setActionErr(`Edit failed: ${(err as Error).message}`);
                });
              }}
            >
              <h3
                id={`edit-checklist-item-title-${position.id}`}
                className="mb-3 text-lg font-semibold"
              >
                {editingItem.kind === "header" ? "Edit section header" : "Edit checklist item"}
              </h3>
              <label className="mb-1 block text-sm font-medium">
                {editingItem.kind === "header" ? "Header text" : "Checklist text"}
              </label>
              <input
                autoFocus
                value={editingItem.text}
                onChange={(e) =>
                  setEditingItem((prev) => (prev ? { ...prev, text: e.target.value } : prev))
                }
                placeholder={editingItem.kind === "header" ? "Section header" : "Checklist text"}
                className="mb-3 w-full rounded-lg border bg-background p-3"
              />
              {editingItem.kind !== "header" && (
                <>
                  <label className="mb-1 block text-sm font-medium">Description (optional)</label>
                  <textarea
                    value={editingItem.description}
                    onChange={(e) =>
                      setEditingItem((prev) =>
                        prev ? { ...prev, description: e.target.value } : prev,
                      )
                    }
                    placeholder="Description (optional)"
                    className="mb-3 w-full rounded-lg border bg-background p-3"
                    rows={3}
                  />
                </>
              )}
              {editItemErr && <p className="mb-3 text-sm text-rose-600">{editItemErr}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditingItem(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-accent rounded-lg px-4 py-2 text-sm font-medium"
                >
                  Save
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
      {addHeaderOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`add-header-title-${position.id}`}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setAddHeaderOpen(false);
              }
            }}
          >
            <form
              className="w-full max-w-md rounded-xl border bg-card p-5 shadow-lg"
              onMouseDown={(e) => e.stopPropagation()}
              onSubmit={async (e) => {
                e.preventDefault();
                const text = addHeaderText.trim();
                if (text.length < 1) {
                  setAddHeaderErr("Header text is required.");
                  return;
                }
                setAddHeaderErr("");
                try {
                  const created = await api<{
                    item: {
                      id: string;
                      text: string;
                      description: string | null;
                      kind: ChecklistKind;
                    };
                  }>(`/api/positions/${position.id}/items`, {
                    method: "POST",
                    body: JSON.stringify({ text, kind: "header" }),
                  });
                  setPositions((prev) =>
                    prev.map((p) =>
                      p.id === position.id
                        ? { ...p, items: [...p.items, created.item] }
                        : p,
                    ),
                  );
                  setAddHeaderOpen(false);
                  setAddHeaderText("");
                } catch (err) {
                  setAddHeaderErr((err as Error).message);
                }
              }}
            >
              <h3 id={`add-header-title-${position.id}`} className="mb-3 text-lg font-semibold">
                Add section header
              </h3>
              <label className="mb-1 block text-sm font-medium">Header text</label>
              <input
                autoFocus
                value={addHeaderText}
                onChange={(e) => setAddHeaderText(e.target.value)}
                placeholder="e.g. Bagging basics"
                className="mb-3 w-full rounded-lg border bg-background p-3"
              />
              {addHeaderErr && <p className="mb-3 text-sm text-rose-600">{addHeaderErr}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setAddHeaderOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-accent rounded-lg px-4 py-2 text-sm font-medium"
                >
                  Add header
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
      {addChecklistItemOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`add-checklist-item-title-${position.id}`}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setItemErr("");
                setAddChecklistItemOpen(false);
              }
            }}
          >
            <form
              className="w-full max-w-md rounded-xl border bg-card p-5 shadow-lg"
              onMouseDown={(e) => e.stopPropagation()}
              onSubmit={async (e) => {
                e.preventDefault();
                setItemErr("");
                try {
                  await api(`/api/positions/${position.id}/items`, {
                    method: "POST",
                    body: JSON.stringify({
                      text: itemText,
                      description: itemDesc || undefined,
                    }),
                  });
                  setItemText("");
                  setItemDesc("");
                  setAddChecklistItemOpen(false);
                  await onRefresh();
                } catch (error) {
                  setItemErr((error as Error).message);
                }
              }}
            >
              <h3
                id={`add-checklist-item-title-${position.id}`}
                className="mb-3 text-lg font-semibold"
              >
                Add checklist item
              </h3>
              <label className="mb-1 block text-sm font-medium">Checklist text</label>
              <input
                autoFocus
                value={itemText}
                onChange={(e) => setItemText(e.target.value)}
                placeholder="Checklist text"
                className="mb-3 w-full rounded-lg border bg-background p-3"
                required
              />
              <label className="mb-1 block text-sm font-medium">Description (optional)</label>
              <textarea
                value={itemDesc}
                onChange={(e) => setItemDesc(e.target.value)}
                placeholder="Description (optional)"
                className="mb-3 w-full rounded-lg border bg-background p-3"
                rows={3}
              />
              {itemErr && <p className="mb-3 text-sm text-rose-600">{itemErr}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setItemErr("");
                    setAddChecklistItemOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-accent rounded-lg px-4 py-2 text-sm font-medium">
                  Add item
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** A single sortable row in the checklist list. Renders both regular items and section headers. */
function SortableChecklistItemRow({
  item,
  onEdit,
  onDelete,
}: {
  item: { id: string; text: string; description: string | null; kind: ChecklistKind };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    setNodeRef: setItemNodeRef,
    attributes: itemDragAttributes,
    listeners: itemDragListeners,
    transform: itemTransform,
    transition: itemTransition,
    isDragging: isItemDragging,
  } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(itemTransform),
    transition: itemTransition,
    opacity: isItemDragging ? 0.6 : 1,
  };
  const isHeader = item.kind === "header";
  return (
    <li
      ref={setItemNodeRef}
      style={style}
      className={
        isHeader
          ? "flex items-center justify-between gap-2 rounded-md border border-slate-300 bg-slate-200/70 px-2 py-2 dark:border-slate-500 dark:bg-slate-700/70"
          : "flex items-start justify-between gap-2 rounded-md border border-slate-200 bg-slate-50/80 px-2 py-2 dark:border-slate-600 dark:bg-slate-800/50"
      }
    >
      <button
        type="button"
        aria-label={isHeader ? `Drag section header ${item.text}` : `Drag checklist item ${item.text}`}
        title="Drag to reorder"
        className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-1 text-slate-400 hover:text-slate-700 active:cursor-grabbing dark:text-slate-500 dark:hover:text-slate-200"
        {...itemDragAttributes}
        {...itemDragListeners}
      >
        <DragHandleIcon className="h-4 w-4" />
      </button>
      <span className="min-w-0 flex-1">
        {isHeader ? (
          <span className="block text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-100">
            {item.text}
          </span>
        ) : (
          <>
            <span className="block">{item.text}</span>
            {item.description && (
              <span className="mt-0.5 block whitespace-pre-wrap text-xs opacity-70">{item.description}</span>
            )}
          </>
        )}
      </span>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          aria-label={
            isHeader ? `Edit section header ${item.text}` : `Edit checklist item ${item.text}`
          }
          title={isHeader ? "Edit section header" : "Edit checklist item"}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
          onClick={onEdit}
        >
          <PencilIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label={
            isHeader ? `Delete section header ${item.text}` : `Delete checklist item ${item.text}`
          }
          title={isHeader ? "Delete section header" : "Delete checklist item"}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onDelete}
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      </div>
    </li>
  );
}
