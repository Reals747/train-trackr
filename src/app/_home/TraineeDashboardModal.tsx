"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { ChecklistCheckboxIcon, ChevronDisclosureIcon } from "./icons";
import type { DashboardPositionDetail, DashboardRow } from "./types";

export function PositionChecklistStatusTag({ status }: { status: DashboardPositionDetail["status"] }) {
  const slateMutedBadge =
    "shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 max-sm:ring-1 max-sm:ring-inset max-sm:ring-slate-300/80 dark:max-sm:ring-slate-500/50";

  if (status === "none" || status === "unavailable") {
    return (
      <span className={slateMutedBadge}>
        {status === "unavailable" ? "No items" : "Not started"}
      </span>
    );
  }
  if (status === "complete") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100 max-sm:ring-1 max-sm:ring-inset max-sm:ring-emerald-300/90 dark:max-sm:ring-emerald-500/50">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="size-[14px] shrink-0"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-7.5 10.5a.75.75 0 01-1.127.082l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 6.948-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
        Completed
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100 max-sm:ring-1 max-sm:ring-inset max-sm:ring-amber-300/90 dark:max-sm:ring-amber-500/50">
        In progress
      </span>
    );
  }
  const _exhaustive: never = status;
  return _exhaustive;
}

type TraineeModalCommentsState =
  | { kind: "ok"; entries: { positionId: string; positionName: string; generalComments: string }[] }
  | { kind: "error"; message: string };

export function TraineeDashboardModal({
  row,
  onClose,
}: {
  row: DashboardRow;
  onClose: () => void;
}) {
  const [panel, setPanel] = useState<"progress" | "comments">("progress");
  const [commentsState, setCommentsState] = useState<TraineeModalCommentsState | null>(null);
  const [commentsRetry, setCommentsRetry] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const visiblePositionDetails = useMemo(
    () => row.positionDetails.filter((p) => !p.hidden),
    [row.positionDetails],
  );

  useEffect(() => {
    if (panel !== "comments") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api<{ entries: { positionId: string; positionName: string; generalComments: string }[] }>(
          `/api/workflow-general-comments/for-trainee?traineeId=${encodeURIComponent(row.id)}`,
        );
        if (!cancelled) setCommentsState({ kind: "ok", entries: res.entries });
      } catch (e) {
        if (!cancelled) {
          setCommentsState({
            kind: "error",
            message: e instanceof Error ? e.message : "Could not load comments",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [panel, row.id, commentsRetry]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trainee-dashboard-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-xl border bg-card p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="trainee-dashboard-modal-title" className="text-lg font-semibold">
              {row.name}
            </h2>
            <p className="mt-1 text-sm opacity-80">
              {row.percentage}% complete · Completed {row.positionsFullyComplete}/{row.storePositionCount}{" "}
              positions · Remaining {row.remainingPositions}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {panel === "progress" ? (
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={() => {
                  setCommentsState(null);
                  setPanel("comments");
                }}
              >
                View comments
              </button>
            ) : (
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={() => setPanel("progress")}
              >
                View progress
              </button>
            )}
            <button
              type="button"
              className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        {panel === "progress" ? (
          <>
            <p className="mb-3 text-sm opacity-80">
              Store positions are listed below. Expand a position to see each checklist item.
            </p>

            <div className="space-y-2">
              {visiblePositionDetails.length === 0 ? (
                <p className="rounded-lg border p-3 text-sm opacity-80">
                  No visible positions for this store.
                </p>
              ) : null}
              {visiblePositionDetails.map((pos) => {
                const isOpen = expanded[pos.positionId];
                return (
                  <div key={pos.positionId} className="rounded-lg border text-sm">
                    <button
                      type="button"
                      className="flex w-full flex-nowrap items-center gap-x-2 overflow-x-auto overflow-y-hidden px-3 py-2 text-left font-medium [-webkit-overflow-scrolling:touch] sm:flex-wrap sm:overflow-visible"
                      onClick={() =>
                        setExpanded((e) => ({ ...e, [pos.positionId]: !e[pos.positionId] }))
                      }
                      aria-expanded={isOpen}
                    >
                      <ChevronDisclosureIcon
                        expanded={isOpen}
                        className="size-[16px] shrink-0 opacity-60"
                      />
                      <span className="min-w-0 flex-1 truncate">{pos.name}</span>
                      <span className="ml-auto flex shrink-0 flex-nowrap items-center justify-end gap-1.5">
                        <span className="shrink-0 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                          {pos.completedItems}/{pos.totalItems}
                        </span>
                        <PositionChecklistStatusTag status={pos.status} />
                      </span>
                    </button>

                    {isOpen && (
                      <div className="space-y-2 border-t border-slate-200 px-3 py-3 dark:border-slate-600">
                        {pos.items.length === 0 ? (
                          <p className="text-xs opacity-70">No checklist items for this position.</p>
                        ) : (
                          <ul className="space-y-2">
                            {pos.items.map((item) => (
                              <li key={item.id} className="flex items-start gap-2">
                                <ChecklistCheckboxIcon
                                  completed={item.completed}
                                  className="mt-0.5 h-[20px] w-[20px] shrink-0"
                                />
                                <span className={item.completed ? "text-foreground" : "opacity-90"}>
                                  {item.text}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : !commentsState ? (
          <p className="text-sm opacity-80" role="status">
            Loading comments…
          </p>
        ) : commentsState.kind === "error" ? (
          <div className="space-y-3">
            <p className="text-sm text-rose-600">{commentsState.message}</p>
            <button
              type="button"
              className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={() => {
                setCommentsState(null);
                setCommentsRetry((n) => n + 1);
              }}
            >
              Try again
            </button>
          </div>
        ) : commentsState.entries.length === 0 ? (
          <p className="text-sm opacity-80">
            No saved general comments for any position yet. Comments are added from the checklist
            workflow page.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm opacity-80">Positions with saved comments (from the workflow page).</p>
            <div className="space-y-3">
              {commentsState.entries.map((entry) => (
                <div key={entry.positionId} className="rounded-lg border border-slate-200 p-3 dark:border-slate-600">
                  <h3 className="text-sm font-semibold text-foreground">{entry.positionName}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm opacity-90">{entry.generalComments}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
