"use client";

import { clientApi } from "@/lib/client-api";
import { formatDateTime } from "@/lib/format-datetime";
import { can, type RoleName } from "@/lib/permissions";
import LoadingScreen from "@/components/LoadingScreen";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type AppUser = {
  id: string;
  name: string;
  username: string;
  storeName: string;
  storeCode: string;
  role: RoleName;
};
type AppearanceSettings = {
  darkMode: boolean;
  fontScale: number;
  accent: string;
  compactCards: boolean;
  followSystemTheme: boolean;
};
type DashboardRow = {
  id: string;
  name: string;
  percentage: number;
  positionsFullyComplete: number;
  storePositionCount: number;
  remainingPositions: number;
};
type PositionOption = { id: string; name: string };
type ProgressItem = {
  id: string;
  text: string;
  description: string | null;
  /** "header" rows are non-interactive section dividers and never count toward completion. */
  kind?: "item" | "header";
  completed: boolean;
  trainerName: string | null;
  notes: string | null;
  completedAt: string | null;
};

const DEFAULT_APPEARANCE: AppearanceSettings = {
  darkMode: false,
  fontScale: 1,
  accent: "#dc2626",
  compactCards: false,
  followSystemTheme: true,
};

function ChecklistCheckboxIcon({ completed, className }: { completed: boolean; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className ?? "size-full shrink-0 text-current"}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z"
      />
      {completed && (
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 12.75 2.25 2.25L15 9.75" />
      )}
    </svg>
  );
}

export function WorkflowSessionClient({
  traineeId,
  positionId,
}: {
  traineeId: string;
  /** Optional deep-link from URL query `position`. */
  positionId: string;
}) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [row, setRow] = useState<DashboardRow | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [selectedPositionId, setSelectedPositionId] = useState(positionId);
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false,
  );

  const canTrain = user ? can(user.role, "workflow.edit") : false;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemPrefersDark(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", appearance.accent);
    document.documentElement.style.setProperty("--font-scale", String(appearance.fontScale));
  }, [appearance.accent, appearance.fontScale]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const applyDark = (dark: boolean) => {
      document.documentElement.classList.toggle("dark", dark);
    };
    if (appearance.followSystemTheme) {
      applyDark(systemPrefersDark);
      return;
    }
    applyDark(appearance.darkMode);
  }, [appearance.followSystemTheme, appearance.darkMode, systemPrefersDark]);

  const refreshDashboardRow = useCallback(async () => {
    const dash = await clientApi<{ trainees: DashboardRow[] }>("/api/dashboard");
    const found = dash.trainees.find((t) => t.id === traineeId) ?? null;
    setRow(found);
  }, [traineeId]);

  const refreshProgress = useCallback(async () => {
    if (!selectedPositionId || !traineeId) {
      setProgressItems([]);
      return;
    }
    setProgressLoading(true);
    try {
      const res = await clientApi<{ items: ProgressItem[] }>(
        `/api/progress?traineeId=${encodeURIComponent(traineeId)}&positionId=${encodeURIComponent(selectedPositionId)}`,
      );
      setProgressItems(res.items);
    } catch {
      setProgressItems([]);
    } finally {
      setProgressLoading(false);
    }
  }, [traineeId, selectedPositionId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError("");
      setLoading(true);
      try {
        const me = await clientApi<{ user: AppUser }>("/api/auth/me");
        if (cancelled) return;
        setUser(me.user);
        try {
          const appRes = await clientApi<{ appearance: AppearanceSettings }>("/api/settings/appearance");
          if (!cancelled) setAppearance(appRes.appearance);
        } catch {
          if (!cancelled) setAppearance(DEFAULT_APPEARANCE);
        }
        try {
          const dash = await clientApi<{ trainees: DashboardRow[] }>("/api/dashboard");
          if (cancelled) return;
          const found = dash.trainees.find((t) => t.id === traineeId) ?? null;
          setRow(found);
          if (!found) setLoadError("Trainee not found or you may not have access.");
          else setLoadError("");
        } catch {
          if (!cancelled) {
            setRow(null);
            setLoadError("Could not load trainee progress.");
          }
        }
        try {
          const posRes = await clientApi<{ positions: PositionOption[] }>(
            "/api/positions?excludeHidden=1",
          );
          if (!cancelled) setPositions(posRes.positions.map((p) => ({ id: p.id, name: p.name })));
        } catch {
          if (!cancelled) setPositions([]);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setLoadError("Unable to load session. Sign in from the main app and try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [traineeId]);

  useEffect(() => {
    void refreshProgress();
  }, [refreshProgress]);

  /**
   * Optimistically toggle a checklist item's completion state.
   *
   * The local state is updated immediately so the UI feels instant; the server
   * write and dashboard refresh happen in the background. On failure we revert
   * the optimistic change and surface an error. This replaces the previous
   * flow of awaiting POST + GET /api/progress + GET /api/dashboard on every
   * click, which added a visible ~1s delay on each tap.
   */
  const setItemCompleted = useCallback(
    (itemId: string, completed: boolean) => {
      let previous: ProgressItem[] | null = null;
      setProgressItems((items) => {
        previous = items;
        return items.map((it) =>
          it.id === itemId
            ? {
                ...it,
                completed,
                trainerName: completed ? user?.name ?? it.trainerName : null,
                completedAt: completed ? new Date().toISOString() : null,
              }
            : it,
        );
      });

      setPendingSaves((n) => n + 1);
      void (async () => {
        try {
          await clientApi("/api/progress", {
            method: "POST",
            body: JSON.stringify({ traineeId, checklistItemId: itemId, completed }),
          });
          // Refresh dashboard counters in the background; don't block the UI.
          void refreshDashboardRow();
        } catch (err) {
          if (previous) setProgressItems(previous);
          setLoadError(
            err instanceof Error ? err.message : "Could not save progress. Try again.",
          );
          // Re-sync from the server to make sure we reflect the real state.
          void refreshProgress();
        } finally {
          setPendingSaves((n) => Math.max(0, n - 1));
        }
      })();
    },
    [traineeId, user, refreshDashboardRow, refreshProgress],
  );

  useEffect(() => {
    if (positions.length === 0 || !selectedPositionId) return;
    const exists = positions.some((p) => p.id === selectedPositionId);
    if (!exists) setSelectedPositionId("");
  }, [positions, selectedPositionId]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user && loadError) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 p-3 sm:p-6">
        <p className="text-sm text-rose-600">{loadError}</p>
        <Link href="/" className="text-sm text-blue-600 underline">
          Back to Training Tracker
        </Link>
      </main>
    );
  }

  return (
    <main
      className={`mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 p-3 sm:p-6 ${appearance.compactCards ? "gap-2 p-2 sm:p-4" : ""}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{row?.name ?? "Trainee"}</h1>
          {row && (
            <p className="mt-1 text-sm opacity-80">
              {row.percentage}% complete · Completed {row.positionsFullyComplete}/{row.storePositionCount} positions ·
              Remaining {row.remainingPositions}
            </p>
          )}
          {loadError && !row && <p className="mt-2 text-sm text-rose-600">{loadError}</p>}

          <div className="mt-3 flex max-w-md flex-col gap-2">
            <label htmlFor="workflow-session-position" className="sr-only">
              Position
            </label>
            <select
              id="workflow-session-position"
              className="w-full rounded-lg border border-slate-200 bg-card p-3 text-foreground dark:border-slate-600"
              value={selectedPositionId}
              onChange={(e) => setSelectedPositionId(e.target.value)}
            >
              <option value="">Select position</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        >
          Back to app
        </Link>
      </header>

      <section className="rounded-xl bg-card p-4 shadow-sm">
        {!selectedPositionId && (
          <p className="text-sm opacity-70">Choose a position to view and update the checklist.</p>
        )}
        {selectedPositionId && progressLoading && (
          <p className="text-sm opacity-70">Loading checklist…</p>
        )}
        {selectedPositionId && !progressLoading && progressItems.length === 0 && (
          <p className="text-sm opacity-70">No checklist items for this position.</p>
        )}
        {pendingSaves > 0 && progressItems.length > 0 && (
          <p
            className="mb-2 text-xs opacity-70"
            role="status"
            aria-live="polite"
          >
            Saving…
          </p>
        )}
        <div className="space-y-2">
          {progressItems.map((item) => {
            if (item.kind === "header") {
              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-300 bg-slate-200/70 px-3 py-2 text-sm font-semibold uppercase tracking-wide text-slate-800 dark:border-slate-500 dark:bg-slate-700/70 dark:text-slate-100"
                >
                  {item.text}
                </div>
              );
            }
            return (
              <div
                key={item.id}
                className="flex items-start gap-[0.5em] text-base leading-normal rounded-lg border border-slate-200 p-3 dark:border-slate-600"
              >
                <button
                  type="button"
                  disabled={!canTrain || item.completed}
                  aria-pressed={item.completed}
                  aria-label={item.completed ? `${item.text} completed` : `Mark ${item.text} complete`}
                  onClick={() => {
                    if (item.completed) return;
                    setItemCompleted(item.id, true);
                  }}
                  className={`flex flex-1 items-start gap-[0.5em] text-left ${
                    canTrain && !item.completed
                      ? "cursor-pointer"
                      : "cursor-default"
                  } ${!canTrain ? "opacity-90" : ""}`}
                >
                  <span className="flex size-[2lh] shrink-0 items-center justify-center text-slate-600 dark:text-slate-400">
                    <ChecklistCheckboxIcon completed={item.completed} className="size-full" />
                  </span>
                  <span className="flex-1">
                    <strong>{item.text}</strong>
                    {item.description && <p className="text-sm opacity-70">{item.description}</p>}
                    {item.completedAt && (
                      <p className="text-xs opacity-70">
                        {item.trainerName} • {formatDateTime(item.completedAt)}
                      </p>
                    )}
                  </span>
                </button>
                {item.completed && canTrain && (
                  <button
                    type="button"
                    aria-label={`Clear completion for ${item.text}`}
                    title="Clear completion"
                    onClick={() => {
                      setItemCompleted(item.id, false);
                    }}
                    className="shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-600 focus-visible:outline focus-visible:ring-2 focus-visible:ring-slate-400 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-rose-400"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="size-5"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                      />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
