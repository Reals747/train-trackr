"use client";

import { clientApi } from "@/lib/client-api";
import { formatDateTime } from "@/lib/format-datetime";
import { can, type RoleName } from "@/lib/permissions";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type AppUser = {
  id: string;
  name: string;
  email: string;
  storeName: string;
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

  useEffect(() => {
    if (positions.length === 0 || !selectedPositionId) return;
    const exists = positions.some((p) => p.id === selectedPositionId);
    if (!exists) setSelectedPositionId("");
  }, [positions, selectedPositionId]);

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 p-3 sm:p-6">
        <p className="text-sm opacity-70">Loading…</p>
      </main>
    );
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
              {row.percentage}% complete · Done {row.positionsFullyComplete}/{row.storePositionCount} positions ·
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
        <div className="space-y-2">
          {progressItems.map((item) => (
            <label
              key={item.id}
              className={`flex items-start gap-[0.5em] text-base leading-normal rounded-lg border border-slate-200 p-3 dark:border-slate-600 ${canTrain ? "cursor-pointer" : "cursor-default opacity-90"}`}
            >
              <input
                type="checkbox"
                checked={item.completed}
                disabled={!canTrain}
                className="sr-only"
                onChange={async (e) => {
                  await clientApi("/api/progress", {
                    method: "POST",
                    body: JSON.stringify({
                      traineeId,
                      checklistItemId: item.id,
                      completed: e.target.checked,
                    }),
                  });
                  await refreshProgress();
                  await refreshDashboardRow();
                }}
              />
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
            </label>
          ))}
        </div>
      </section>
    </main>
  );
}
