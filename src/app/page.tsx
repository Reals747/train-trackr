"use client";

import {
  Dispatch,
  FormEvent,
  SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { formatDateTime } from "@/lib/format-datetime";
import { can, roleLabel, type Permission, type RoleName } from "@/lib/permissions";

type Role = RoleName;
type AppUser = { id: string; name: string; email: string; role: Role; storeName: string };
type Position = {
  id: string;
  name: string;
  hidden: boolean;
  items: { id: string; text: string; description: string | null }[];
};
type Trainee = {
  id: string;
  name: string;
  startDate: string;
  positions: { positionId: string; position: { id: string; name: string } }[];
};
type DashboardPositionDetail = {
  positionId: string;
  name: string;
  hidden: boolean;
  totalItems: number;
  completedItems: number;
  /** Derived from checklist: all done, none done, partial, or no checklist items (shown as "No items"). */
  status: "complete" | "partial" | "none" | "unavailable";
  items: { id: string; text: string; completed: boolean }[];
};

type DashboardRow = {
  id: string;
  name: string;
  percentage: number;
  positionsFullyComplete: number;
  storePositionCount: number;
  remainingPositions: number;
  positionDetails: DashboardPositionDetail[];
};
type ActivityLog = { id: string; message: string; actor: string; createdAt: string };
type AuthMode = "login" | "register-admin" | "register-trainer";
type SettingsCategory =
  | "account"
  | "store"
  | "appearance"
  | "trainers"
  | "traineeManagement"
  | "trainingSetup";
type AccountDetails = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  storeName: string;
  storeId: string;
};
type StoreDetails = {
  id: string;
  name: string;
  createdAt: string;
  _count: { users: number; positions: number; trainees: number };
};
type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  trainerInviteCodeUsed: string | null;
};
type AppearanceSettings = {
  darkMode: boolean;
  fontScale: number;
  accent: string;
  compactCards: boolean;
  /** When true, theme follows OS/browser `prefers-color-scheme`; manual toggle is disabled. */
  followSystemTheme: boolean;
};
type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  authorName: string;
  authorId: string;
  comments: {
    id: string;
    body: string;
    createdAt: string;
    userId: string;
    userName: string;
  }[];
};

const DEFAULT_APPEARANCE: AppearanceSettings = {
  darkMode: false,
  fontScale: 1,
  accent: "#dc2626",
  compactCards: false,
  followSystemTheme: true,
};

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className ?? "h-5 w-5"}
      aria-hidden
    >
      <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zm6.303 7.758a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591z" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className ?? "h-5 w-5"}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
      />
    </svg>
  );
}

/** Outline history / recent activity (Lucide “History” paths, stroke matched to gear icon). */
function ActivityHistoryIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className ?? "h-5 w-5 shrink-0"}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v5h5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l4 2" />
    </svg>
  );
}

/** Outline gear icon (same visual language as Apple SF Symbols “gearshape”; SVG for web compatibility). */
function SettingsGearIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className ?? "h-5 w-5 shrink-0"}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

/** Chevron right when collapsed, down when expanded. */
function ChevronDisclosureIcon({ expanded, className }: { expanded: boolean; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className ?? "h-4 w-4 shrink-0 opacity-60"}
      aria-hidden
    >
      {expanded ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
      )}
    </svg>
  );
}

/** Rounded checkbox outline; stroke check when completed. */
function ChecklistCheckboxIcon({ completed, className }: { completed: boolean; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className ?? "h-[20px] w-[20px] shrink-0"}
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

/** Outline trashcan icon (matches stroke style of the other outline icons). */
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className ?? "h-5 w-5 shrink-0"}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
      />
    </svg>
  );
}

/** Horizontal ellipsis for overflow menus. */
function EllipsisHorizontalIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className ?? "h-5 w-5 shrink-0"}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
      />
    </svg>
  );
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || "Request failed");
  }
  return response.json() as Promise<T>;
}

function PositionChecklistStatusTag({ status }: { status: DashboardPositionDetail["status"] }) {
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

function TraineeDashboardModal({
  row,
  onClose,
}: {
  row: DashboardRow;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const visiblePositionDetails = useMemo(
    () => row.positionDetails.filter((p) => !p.hidden),
    [row.positionDetails],
  );

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
          <button
            type="button"
            className="shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <p className="mb-3 text-sm opacity-80">
          Visible store positions are listed below. Hidden positions are omitted. Expand a
          position to see each checklist item.
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
      </div>
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [error, setError] = useState<string>("");
  const [tab, setTab] = useState("dashboard");
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>("account");
  const [positions, setPositions] = useState<Position[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [dashboard, setDashboard] = useState<DashboardRow[]>([]);
  const [dashboardModalTraineeId, setDashboardModalTraineeId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [selectedTraineeId, setSelectedTraineeId] = useState("");
  const [search, setSearch] = useState("");
  const [accountDetails, setAccountDetails] = useState<AccountDetails | null>(null);
  const [storeDetails, setStoreDetails] = useState<StoreDetails | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [appearanceReady, setAppearanceReady] = useState(false);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false,
  );

  const canTrain = can(user?.role, "workflow.edit");
  const canViewActivity = can(user?.role, "activity.view");
  /** Same gate as Settings → Trainee Management (owner/admin). */
  const canOpenTraineeManagement = can(user?.role, "trainees.delete");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemPrefersDark(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const refreshCore = useCallback(async () => {
    const [positionsRes, traineesRes, dashboardRes, accountRes, annRes] = await Promise.all([
      api<{ positions: Position[] }>("/api/positions"),
      api<{ trainees: Trainee[] }>("/api/trainees"),
      api<{ trainees: DashboardRow[] }>("/api/dashboard"),
      api<{ account: AccountDetails }>("/api/settings/account"),
      api<{ announcements: AnnouncementRow[] }>("/api/announcements"),
    ]);
    setPositions(positionsRes.positions);
    setTrainees(traineesRes.trainees);
    setDashboard(dashboardRes.trainees);
    setAccountDetails(accountRes.account);
    setAnnouncements(annRes.announcements);

    /** Keep session role aligned with DB (e.g. promoted/demoted in another tab). */
    setUser((prev) => {
      if (!prev || prev.id !== accountRes.account.id) return prev;
      if (prev.role === accountRes.account.role) return prev;
      return { ...prev, role: accountRes.account.role };
    });

    /** DB role from `/api/settings/account` — React `user.role` can lag behind (other tab / promotion). */
    const accessRole = accountRes.account.role;
    if (can(accessRole, "activity.view")) {
      try {
        const activityRes = await api<{ logs: ActivityLog[] }>("/api/activity");
        setActivity(activityRes.logs);
      } catch {
        setActivity([]);
      }
    } else {
      setActivity([]);
    }
    if (can(accessRole, "members.view")) {
      const [storeOutcome, teamOutcome] = await Promise.allSettled([
        api<{ store: StoreDetails }>("/api/settings/store-details"),
        api<{ members: TeamMember[] }>("/api/settings/trainers"),
      ]);
      if (storeOutcome.status === "fulfilled") {
        setStoreDetails(storeOutcome.value.store);
      }
      if (teamOutcome.status === "fulfilled") {
        setTeamMembers(teamOutcome.value.members);
      }
    } else {
      setStoreDetails(null);
      setTeamMembers([]);
    }
  }, []);

  const refreshCoreRef = useRef(refreshCore);
  refreshCoreRef.current = refreshCore;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api<{ user: AppUser }>("/api/auth/me");
        if (cancelled) return;
        setUser(me.user);
        try {
          await refreshCoreRef.current();
        } catch {
          /* Session is valid; partial load failure — next poll will retry. */
        }
      } catch {
        if (!cancelled) setUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Load per-user appearance from the server so it matches on every device for this account. */
  useEffect(() => {
    if (!user) {
      setAppearance(DEFAULT_APPEARANCE);
      setAppearanceReady(false);
      return;
    }
    let cancelled = false;
    setAppearanceReady(false);
    (async () => {
      try {
        const res = await api<{ appearance: AppearanceSettings }>("/api/settings/appearance");
        if (!cancelled) setAppearance(res.appearance);
      } catch {
        if (!cancelled) setAppearance(DEFAULT_APPEARANCE);
      } finally {
        if (!cancelled) setAppearanceReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", appearance.accent);
    document.documentElement.style.setProperty("--font-scale", String(appearance.fontScale));
  }, [appearance.accent, appearance.fontScale]);

  /** Apply `html.dark` from manual choice or from `prefers-color-scheme` when following system. */
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

  /** Persist appearance for this user (debounced) — stored in DB, not localStorage. */
  useEffect(() => {
    if (!user || !appearanceReady) return;
    const handle = window.setTimeout(() => {
      api("/api/settings/appearance", {
        method: "PUT",
        body: JSON.stringify(appearance),
      }).catch(() => undefined);
    }, 450);
    return () => window.clearTimeout(handle);
  }, [appearance, user, appearanceReady]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (user) {
        refreshCore().catch(() => undefined);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [user, refreshCore]);

  const filteredDashboard = useMemo(
    () => dashboard.filter((row) => row.name.toLowerCase().includes(search.toLowerCase())),
    [dashboard, search],
  );

  const dashboardModalRow = useMemo(
    () =>
      dashboardModalTraineeId
        ? dashboard.find((r) => r.id === dashboardModalTraineeId)
        : undefined,
    [dashboard, dashboardModalTraineeId],
  );

  useEffect(() => {
    if (tab !== "dashboard") setDashboardModalTraineeId(null);
  }, [tab]);

  useEffect(() => {
    if (!canViewActivity && tab === "activity") setTab("dashboard");
  }, [canViewActivity, tab]);

  if (!user) {
    return (
      <AuthScreen
        onLoggedIn={(nextUser) => {
          setUser(nextUser);
        }}
        onError={setError}
        error={error}
      />
    );
  }

  return (
    <main className={`mx-auto flex min-h-screen w-full max-w-5xl flex-col ${appearance.compactCards ? "gap-2 p-2 sm:p-4" : "gap-4 p-3 sm:p-6"}`}>
      <header className="rounded-xl bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Training Tracker</h1>
            <p className="text-sm opacity-75">{user.storeName} - {user.name} ({user.role})</p>
          </div>
          <div className="flex gap-2">
            {canViewActivity ? (
              <button
                type="button"
                className={`inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium ${
                  tab === "activity"
                    ? "btn-accent ring-2 ring-offset-2 ring-white/30"
                    : "border border-slate-200 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                }`}
                aria-label="Activity"
                aria-pressed={tab === "activity"}
                onClick={() => setTab("activity")}
              >
                <ActivityHistoryIcon className="h-5 w-5" />
              </button>
            ) : null}
            <button
              type="button"
              className={`inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium ${
                tab === "settings"
                  ? "btn-accent ring-2 ring-offset-2 ring-white/30"
                  : "border border-slate-200 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              }`}
              aria-label="Settings"
              aria-pressed={tab === "settings"}
              onClick={() => {
                setTab("settings");
                setSettingsCategory("account");
              }}
            >
              <SettingsGearIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <nav className="flex flex-row gap-2 rounded-xl bg-card p-2 shadow-sm">
        {(
          [
            ["dashboard", "Dashboard"],
            ["workflow", "Checklist"],
            // ["trainees", "Trainees"], — hidden; restore with TraineePanel block below
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`min-w-0 flex-1 basis-0 whitespace-nowrap rounded-lg px-2 py-3 text-xs font-medium sm:px-3 sm:text-sm ${tab === key ? "btn-accent" : "bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-100"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "dashboard" && (
        <>
          <AnnouncementsSection
            user={user}
            accountDetails={accountDetails}
            announcements={announcements}
            canComment={canTrain}
            onRefresh={refreshCore}
          />
          <section className="rounded-xl bg-card p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Trainee progress</h2>
              {canOpenTraineeManagement ? (
                <button
                  type="button"
                  className="btn-accent rounded-lg px-4 py-2 text-sm font-medium"
                  onClick={() => {
                    setTab("settings");
                    setSettingsCategory("traineeManagement");
                  }}
                >
                  Manage trainees
                </button>
              ) : canTrain ? (
                <AddTraineeModalFlow onRefresh={refreshCore} />
              ) : null}
            </div>
            <input
              className="mb-3 w-full rounded-lg border p-3"
              placeholder="Search trainees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="space-y-3">
              {filteredDashboard.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="w-full rounded-lg border p-3 text-left transition hover:bg-slate-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-slate-400 dark:hover:bg-slate-800/60"
                  onClick={() => setDashboardModalTraineeId(row.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong>{row.name}</strong>
                    <span className="shrink-0 text-sm font-semibold">{row.percentage}%</span>
                  </div>
                  <p className="text-sm">
                    Completed {row.positionsFullyComplete}/{row.storePositionCount} Remaining{" "}
                    {row.remainingPositions}
                  </p>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {tab === "workflow" && (
        <section className="rounded-xl bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Live Training</h2>
          <div className="flex max-w-md flex-col gap-2">
            <select
              className="w-full rounded-lg border border-slate-200 bg-card p-3 text-foreground dark:border-slate-600"
              value={selectedTraineeId}
              onChange={(e) => setSelectedTraineeId(e.target.value)}
            >
              <option value="">Select trainee</option>
              {trainees.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-accent w-full rounded-lg px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              disabled={!selectedTraineeId}
              onClick={() => {
                if (!selectedTraineeId) return;
                window.open(`/workflow/${selectedTraineeId}`, "_blank", "noopener,noreferrer");
              }}
            >
              Load Checklist
            </button>
          </div>
        </section>
      )}

      {/* Trainees tab hidden — see commented TraineePanel below
      {tab === "trainees" && (
        <TraineePanel
          positions={positions}
          trainees={trainees}
          canTrain={canTrain}
          onRefresh={refreshCore}
        />
      )}
      */}

      {canViewActivity && tab === "activity" && (
        <section className="rounded-xl bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Activity Feed</h2>
          <div className="space-y-2">
            {activity.map((log) => (
              <div key={log.id} className="rounded-lg border p-3 text-sm">
                <p>{log.message}</p>
                <p className="opacity-70">{log.actor} • {formatDateTime(log.createdAt)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "settings" && (
        <SettingsPanel
          user={user}
          accountDetails={accountDetails}
          storeDetails={storeDetails}
          teamMembers={teamMembers}
          positions={positions}
          dashboard={dashboard}
          category={settingsCategory}
          appearance={appearance}
          appearanceReady={appearanceReady}
          systemPrefersDark={systemPrefersDark}
          setCategory={setSettingsCategory}
          setAppearance={setAppearance}
          refreshCore={refreshCore}
          onSessionRefresh={async () => {
            try {
              const me = await api<{ user: AppUser }>("/api/auth/me");
              setUser(me.user);
            } catch {
              setUser(null);
            }
          }}
          onLogout={async () => {
            await api("/api/auth/logout", { method: "POST" });
            setUser(null);
          }}
        />
      )}

      {dashboardModalRow && (
        <TraineeDashboardModal
          row={dashboardModalRow}
          onClose={() => setDashboardModalTraineeId(null)}
        />
      )}
    </main>
  );
}

/** Six-cell invite code entry; digits stored in `User`-facing order left-to-right. */
function InviteCodeSixDigit({
  slots,
  onSlotsChange,
}: {
  slots: string[];
  onSlotsChange: (next: string[]) => void;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const setSlots = onSlotsChange;

  function focusSlot(i: number) {
    inputRefs.current[i]?.focus();
    inputRefs.current[i]?.select();
  }

  function handleDigit(i: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...slots];
    if (digit) {
      next[i] = digit;
      setSlots(next);
      if (i < 5) focusSlot(i + 1);
    } else {
      next[i] = "";
      setSlots(next);
    }
  }

  function handleKeyDown(i: number, e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !slots[i] && i > 0) {
      e.preventDefault();
      const next = [...slots];
      next[i - 1] = "";
      setSlots(next);
      focusSlot(i - 1);
    }
  }

  function handlePaste(i: number, e: ReactClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      e.preventDefault();
      setSlots(text.split(""));
      focusSlot(5);
    } else if (text.length > 0 && i === 0) {
      e.preventDefault();
      const next = [...slots];
      for (let j = 0; j < 6; j++) next[j] = text[j] ?? "";
      setSlots(next);
      const last = Math.min(text.length - 1, 5);
      focusSlot(last);
    }
  }

  return (
    <div className="mb-6 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-500 dark:bg-slate-900/40">
      <p className="mb-3 text-center text-sm font-semibold tracking-wide text-foreground">
        Invite code
      </p>
      <div className="flex justify-center gap-2 sm:gap-3">
        {slots.map((ch, i) => (
          <div
            key={i}
            className="relative flex-1 max-w-[4rem] rounded-lg border-2 border-slate-300 bg-card shadow-inner dark:border-slate-500 dark:bg-card"
          >
            <label htmlFor={`invite-digit-${i}`} className="sr-only">
              Digit {i + 1} of 6
            </label>
            <input
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              id={`invite-digit-${i}`}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={1}
              value={ch}
              aria-label={`Invite code digit ${i + 1} of 6`}
              className="min-h-[4rem] h-16 w-full rounded-[inherit] border-0 bg-transparent text-center text-4xl font-semibold tabular-nums leading-none text-foreground outline-none ring-0 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent,#dc2626)] focus-visible:outline-offset-[-2px]"
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={(e) => handlePaste(i, e)}
              onFocus={(e) => e.target.select()}
            />
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs opacity-70">Enter the 6-digit code from your manager</p>
    </div>
  );
}

function AuthScreen({
  onLoggedIn,
  onError,
  error,
}: {
  onLoggedIn: (user: AppUser) => void;
  onError: (value: string) => void;
  error: string;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [inviteSlots, setInviteSlots] = useState<string[]>(() => Array.from({ length: 6 }, () => ""));

  useEffect(() => {
    if (mode === "register-trainer") {
      setInviteSlots(Array.from({ length: 6 }, () => ""));
    }
  }, [mode]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mode === "register-trainer") {
      const code = inviteSlots.join("");
      if (!/^\d{6}$/.test(code)) {
        onError("Enter the full 6-digit invite code.");
        return;
      }
    }
    const formData = new FormData(e.currentTarget);
    onError("");
    try {
      const endpoint =
        mode === "login"
          ? "/api/auth/login"
          : mode === "register-admin"
            ? "/api/auth/register"
            : "/api/auth/register-trainer";
      const payload = (() => {
        if (mode === "login") {
          return { identifier: formData.get("identifier"), password: formData.get("password") };
        }
        if (mode === "register-admin") {
          return {
            storeName: formData.get("storeName"),
            name: formData.get("name"),
            email: formData.get("email"),
            password: formData.get("password"),
          };
        }
        return {
          inviteCode: formData.get("inviteCode"),
          name: formData.get("name"),
          username: formData.get("username"),
          password: formData.get("password"),
        };
      })();
      const res = await api<{ user: AppUser }>(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onLoggedIn(res.user);
    } catch (err) {
      onError((err as Error).message);
    }
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-4 py-8">
      <form
        onSubmit={submit}
        className="relative z-10 w-full rounded-xl bg-card p-5 shadow-sm"
        autoComplete="on"
      >
        <h1 className="text-2xl font-bold">Training Tracker</h1>
        <p className="mb-4 text-sm opacity-75">Mobile-first training for fast shifts.</p>
        {mode === "register-trainer" && (
          <>
            <InviteCodeSixDigit slots={inviteSlots} onSlotsChange={setInviteSlots} />
            <input type="hidden" name="inviteCode" value={inviteSlots.join("")} readOnly />
          </>
        )}
        {mode === "register-admin" && (
          <input
            name="storeName"
            placeholder="Store name"
            className="mb-2 w-full rounded-lg border p-3 text-base"
            required
            autoComplete="organization"
          />
        )}
        {mode !== "login" && (
          <input
            name="name"
            placeholder="Full name"
            className="mb-2 w-full rounded-lg border p-3 text-base"
            required
            autoComplete="name"
          />
        )}
        {mode === "login" && (
          <input
            name="identifier"
            type="text"
            placeholder="Email or username"
            className="mb-2 w-full rounded-lg border p-3 text-base"
            required
            autoComplete="username"
          />
        )}
        {mode === "register-admin" && (
          <input
            name="email"
            type="email"
            placeholder="Email address"
            className="mb-2 w-full rounded-lg border p-3 text-base"
            required
            autoComplete="email"
          />
        )}
        {mode === "register-trainer" && (
          <input
            name="username"
            type="text"
            placeholder="Username"
            className="mb-2 w-full rounded-lg border p-3 text-base"
            required
            minLength={2}
            maxLength={64}
            pattern="[a-zA-Z0-9._-]+"
            title="Letters, numbers, dots, dashes, and underscores only"
            autoComplete="username"
          />
        )}
        <input
          name="password"
          type="password"
          placeholder="Password (min 8)"
          className="mb-2 w-full rounded-lg border p-3 text-base"
          required
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          enterKeyHint="go"
        />
        {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          className="btn-accent min-h-12 w-full touch-manipulation rounded-lg p-3 text-base font-semibold"
        >
          {mode === "login" ? "Sign in" : mode === "register-admin" ? "Create store" : "Create trainer account"}
        </button>
        <div className="mt-3 space-y-2 text-center text-sm">
          {mode !== "login" && (
            <button
              type="button"
              className="min-h-12 w-full touch-manipulation rounded-lg px-2 py-3 text-base underline underline-offset-2"
              onClick={() => setMode("login")}
            >
              Already have an account? Sign in
            </button>
          )}
          {mode !== "register-admin" && (
            <button
              type="button"
              className="min-h-12 w-full touch-manipulation rounded-lg px-2 py-3 text-base underline underline-offset-2"
              onClick={() => setMode("register-admin")}
            >
              Create a new store (owner)
            </button>
          )}
          {mode !== "register-trainer" && (
            <button
              type="button"
              className="min-h-12 w-full touch-manipulation rounded-lg px-2 py-3 text-base underline underline-offset-2"
              onClick={() => setMode("register-trainer")}
            >
              Sign up with invite code
            </button>
          )}
        </div>
      </form>
    </main>
  );
}

/** Scrollable comment list with edge fades only when more content exists above/below. */
function AnnouncementCommentsScrollArea({
  commentCount,
  children,
}: {
  commentCount: number;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);

  const updateFadeEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const epsilon = 4;
    const hasOverflow = scrollHeight > clientHeight + epsilon;
    if (!hasOverflow) {
      setShowTopFade(false);
      setShowBottomFade(false);
      return;
    }
    setShowTopFade(scrollTop > epsilon);
    setShowBottomFade(scrollTop + clientHeight < scrollHeight - epsilon);
  }, []);

  useLayoutEffect(() => {
    updateFadeEdges();
    const id = requestAnimationFrame(() => updateFadeEdges());
    return () => cancelAnimationFrame(id);
  }, [updateFadeEdges, commentCount]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateFadeEdges());
    ro.observe(el);
    window.addEventListener("resize", updateFadeEdges);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateFadeEdges);
    };
  }, [updateFadeEdges]);

  return (
    <div className="relative overflow-hidden rounded-md border border-neutral-200/80 bg-white/90 dark:border-slate-600 dark:bg-slate-900/40">
      {showTopFade && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-slate-900/18 via-slate-900/6 to-transparent dark:from-black/60 dark:via-black/25"
          aria-hidden
        />
      )}
      <div
        ref={scrollRef}
        onScroll={updateFadeEdges}
        className="max-h-40 overflow-y-auto overscroll-contain pr-1"
      >
        {children}
      </div>
      {showBottomFade && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-slate-900/18 via-slate-900/6 to-transparent dark:from-black/60 dark:via-black/25"
          aria-hidden
        />
      )}
    </div>
  );
}

function AnnouncementsSection({
  user,
  accountDetails,
  announcements,
  canComment,
  onRefresh,
}: {
  user: AppUser;
  accountDetails: AccountDetails | null;
  announcements: AnnouncementRow[];
  canComment: boolean;
  onRefresh: () => Promise<void>;
}) {
  const effectiveRole: Role = accountDetails?.role ?? user.role;
  const canPostAnnouncements = can(effectiveRole, "announcements.post");
  const canDeleteAnnouncements = can(effectiveRole, "announcements.delete");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [postErr, setPostErr] = useState("");
  const [createAnnouncementOpen, setCreateAnnouncementOpen] = useState(false);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [commentsOpen, setCommentsOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!createAnnouncementOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCreateAnnouncementOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createAnnouncementOpen]);

  return (
    <section className="mb-4 rounded-xl bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Announcements</h2>
        {canPostAnnouncements && (
          <button
            type="button"
            className="btn-accent rounded-lg px-4 py-2 text-sm font-medium"
            onClick={() => {
              setPostErr("");
              setCreateAnnouncementOpen(true);
            }}
          >
            Create Announcement
          </button>
        )}
      </div>

      {createAnnouncementOpen && canPostAnnouncements && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-announcement-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCreateAnnouncementOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="create-announcement-title" className="mb-3 text-lg font-semibold">
              Post an update
            </h3>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setPostErr("");
                try {
                  await api("/api/announcements", {
                    method: "POST",
                    body: JSON.stringify({ title, body }),
                  });
                  setTitle("");
                  setBody("");
                  setCreateAnnouncementOpen(false);
                  await onRefresh();
                } catch (err) {
                  setPostErr((err as Error).message);
                }
              }}
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="w-full rounded-lg border bg-background p-3"
                required
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Message to your team..."
                rows={4}
                className="w-full rounded-lg border bg-background p-3"
                required
              />
              {postErr && <p className="text-sm text-rose-600">{postErr}</p>}
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                  onClick={() => setCreateAnnouncementOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-accent rounded-lg px-4 py-2 text-sm font-medium">
                  Publish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {announcements.length === 0 && (
          <p className="text-sm opacity-70">No announcements yet.</p>
        )}
        {announcements.map((a) => (
          <article key={a.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{a.title}</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{a.body}</p>
                <p className="mt-2 text-xs opacity-70">
                  {a.authorName} • {formatDateTime(a.createdAt)}
                </p>
              </div>
              {canDeleteAnnouncements && (
                <button
                  type="button"
                  className="rounded-lg border px-2 py-1 text-xs text-rose-700"
                  onClick={async () => {
                    await api(`/api/announcements/${a.id}`, { method: "DELETE" });
                    await onRefresh();
                  }}
                >
                  Delete
                </button>
              )}
            </div>

            {(a.comments.length > 0 || canComment) && (
              <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-600">
                <button
                  type="button"
                  className="text-sm font-medium text-blue-600 underline decoration-blue-600/40 underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  onClick={() =>
                    setCommentsOpen((prev) => ({ ...prev, [a.id]: !prev[a.id] }))
                  }
                >
                  {commentsOpen[a.id] ? "Hide comments" : "Show comments"}
                  {a.comments.length > 0 ? ` (${a.comments.length})` : ""}
                </button>

                {commentsOpen[a.id] && (
                  <div className="mt-3 rounded-lg border border-neutral-200 bg-[#f7f7f7] p-3 text-black shadow-inner dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100 dark:shadow-inner dark:shadow-black/30">
                    {a.comments.length > 0 && (
                      <AnnouncementCommentsScrollArea commentCount={a.comments.length}>
                        <ul className="divide-y divide-neutral-200 dark:divide-slate-600">
                          {a.comments.map((c) => (
                            <li
                              key={c.id}
                              className="flex flex-col gap-0.5 px-2 py-2 text-sm"
                            >
                              <p
                                className="line-clamp-1 min-w-0 break-words text-black dark:text-slate-50"
                                title={c.body}
                              >
                                {c.body}
                              </p>
                              <p className="text-xs text-neutral-600 dark:text-slate-400">
                                {c.userName} • {formatDateTime(c.createdAt)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </AnnouncementCommentsScrollArea>
                    )}

                    {canComment && (
                      <form
                        className={`flex flex-col gap-2 sm:flex-row ${a.comments.length > 0 ? "mt-3 border-t border-neutral-200 pt-3 dark:border-slate-600" : ""}`}
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const text = (commentText[a.id] ?? "").trim();
                          if (!text) return;
                          await api(`/api/announcements/${a.id}/comments`, {
                            method: "POST",
                            body: JSON.stringify({ body: text }),
                          });
                          setCommentText((prev) => ({ ...prev, [a.id]: "" }));
                          await onRefresh();
                        }}
                      >
                        <input
                          value={commentText[a.id] ?? ""}
                          onChange={(e) =>
                            setCommentText((prev) => ({ ...prev, [a.id]: e.target.value }))
                          }
                          placeholder="Add a comment..."
                          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white p-3 text-black placeholder:text-neutral-500 dark:border-slate-500 dark:bg-slate-900/80 dark:text-slate-100 dark:placeholder:text-slate-400"
                        />
                        <button type="submit" className="btn-accent shrink-0 rounded-lg px-4 py-3 sm:py-2">
                          Comment
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function AddTraineeModalFlow({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [addTraineeOpen, setAddTraineeOpen] = useState(false);

  useEffect(() => {
    if (!addTraineeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAddTraineeOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addTraineeOpen]);

  return (
    <>
      <button
        type="button"
        className="btn-accent rounded-lg px-4 py-2 text-sm font-medium"
        onClick={() => {
          setErr("");
          setName("");
          setAddTraineeOpen(true);
        }}
      >
        Add Trainee
      </button>

      {addTraineeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-trainee-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAddTraineeOpen(false);
          }}
        >
          <div
            className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-xl border bg-card p-5 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="add-trainee-title" className="mb-3 text-lg font-semibold">
              Add Trainee
            </h3>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setErr("");
                try {
                  await api("/api/trainees", {
                    method: "POST",
                    body: JSON.stringify({ name }),
                  });
                  setName("");
                  setAddTraineeOpen(false);
                  await onRefresh();
                } catch (error) {
                  setErr((error as Error).message);
                }
              }}
            >
              <label htmlFor="add-trainee-name" className="sr-only">
                Name
              </label>
              <input
                id="add-trainee-name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="w-full rounded-lg border bg-background p-3"
                required
                autoComplete="name"
              />
              {err && <p className="text-sm text-rose-600">{err}</p>}
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                  onClick={() => setAddTraineeOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-accent rounded-lg px-4 py-2 text-sm font-medium">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/* Trainees tab — entire panel commented out; uncomment + restore nav entry above to show again.
function TraineePanel({
  positions,
  trainees,
  canTrain,
  onRefresh,
}: {
  positions: Position[];
  trainees: Trainee[];
  canTrain: boolean;
  onRefresh: () => Promise<void>;
}) {
  if (!canTrain) return <section className="rounded-xl bg-card p-4 shadow-sm">View only access.</section>;
  return (
    <section className="rounded-xl bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Trainees</h2>
        <AddTraineeModalFlow onRefresh={onRefresh} />
      </div>

      <div className="space-y-2">
        {trainees.map((t) => {
          const positionLabels = (t.positions || [])
            .map((x) => positions.find((p) => p.id === x.positionId)?.name || x.position.name)
            .join(", ")
            .trim();
          return (
            <div key={t.id} className="rounded-lg border p-3 text-sm">
              <p className="font-semibold">{t.name}</p>
              <p>
                Joined {new Date(t.startDate).toLocaleDateString()}
              </p>
              {positionLabels ? <p className="opacity-70">{positionLabels}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
*/

/** Positions and checklists — Settings → Training Setup (managers only). */
function TrainingSetupSection({
  positions,
  onRefresh,
}: {
  positions: Position[];
  onRefresh: () => Promise<void>;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createErr, setCreateErr] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  const sorted = useMemo(() => {
    return [...positions].sort((a, b) => {
      if (a.hidden !== b.hidden) return a.hidden ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [positions]);

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

      <div className="space-y-2">
        {sorted.length === 0 && (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm opacity-70">
            No positions yet. Use Create Position to add one.
          </p>
        )}
        {sorted.map((position) => (
          <PositionTrainingRow key={position.id} position={position} onRefresh={onRefresh} />
        ))}
      </div>
    </div>
  );
}

function PositionTrainingRow({
  position,
  onRefresh,
}: {
  position: Position;
  onRefresh: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [itemText, setItemText] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemErr, setItemErr] = useState("");
  const [actionErr, setActionErr] = useState("");

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

  return (
    <div
      className={`rounded-lg border text-sm ${
        position.hidden
          ? "border-slate-200/90 bg-slate-50/90 text-foreground/85 dark:border-slate-600/90 dark:bg-slate-900/55 dark:text-foreground/85"
          : ""
      } ${menuOpen ? "relative z-50" : ""}`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
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
            className="inline-flex items-center justify-center rounded-lg border px-2 py-1 text-foreground"
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
                onClick={async (e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  setActionErr("");
                  try {
                    await api(`/api/positions/${position.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ hidden: !position.hidden }),
                    });
                    await onRefresh();
                  } catch (err) {
                    setActionErr((err as Error).message);
                  }
                }}
              >
                {position.hidden ? "Show position" : "Hide position"}
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                onClick={async (e) => {
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
                  try {
                    await api(`/api/positions/${position.id}`, { method: "DELETE" });
                    await onRefresh();
                  } catch (err) {
                    setActionErr((err as Error).message);
                  }
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
            <ul className="space-y-2">
              {position.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-2 rounded-md border border-slate-200 bg-slate-50/80 px-2 py-2 dark:border-slate-600 dark:bg-slate-800/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block">{item.text}</span>
                    {item.description && (
                      <span className="mt-0.5 block text-xs opacity-70">{item.description}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 dark:border-rose-500/50 dark:text-rose-400 dark:hover:bg-rose-950/50"
                    onClick={async () => {
                      if (!window.confirm("Remove this checklist item?")) return;
                      try {
                        await api(`/api/checklist-items/${item.id}`, { method: "DELETE" });
                        await onRefresh();
                      } catch (err) {
                        setActionErr((err as Error).message);
                      }
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            className="rounded-lg border border-dashed p-3"
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
                await onRefresh();
              } catch (error) {
                setItemErr((error as Error).message);
              }
            }}
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-70">
              Add checklist item
            </p>
            <input
              value={itemText}
              onChange={(e) => setItemText(e.target.value)}
              placeholder="Checklist text"
              className="mb-2 w-full rounded-lg border p-2"
              required
            />
            <input
              value={itemDesc}
              onChange={(e) => setItemDesc(e.target.value)}
              placeholder="Description (optional)"
              className="mb-2 w-full rounded-lg border p-2"
            />
            {itemErr && <p className="mb-2 text-xs text-rose-600">{itemErr}</p>}
            <button type="submit" className="btn-accent rounded-lg px-3 py-1.5 text-sm">
              Add item
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function TrainerInviteModal({
  open,
  onClose,
  onAfterChange,
}: {
  open: boolean;
  onClose: () => void;
  onAfterChange: () => Promise<void>;
}) {
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!open) return;
    api<{ inviteCode: string | null; expiresAt: string | null }>("/api/settings/invite-code")
      .then((res) => {
        setInviteCode(res.inviteCode);
        setExpiresAt(res.expiresAt);
      })
      .catch(() => {
        setInviteCode(null);
        setExpiresAt(null);
      });
  }, [open]);

  async function generateCode() {
    setStatus("");
    try {
      const res = await api<{ inviteCode: string; expiresAt: string | null }>("/api/settings/invite-code", {
        method: "POST",
      });
      setInviteCode(res.inviteCode);
      setExpiresAt(res.expiresAt);
      setStatus("New code generated. Share it with your trainer — it expires in 7 days.");
      await onAfterChange();
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-xl bg-card p-5 shadow-xl"
        role="dialog"
        aria-labelledby="invite-trainer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="invite-trainer-title" className="text-lg font-semibold">
          Invite Trainer
        </h3>
        <p className="mt-2 text-sm opacity-80">
          Generate a one-time 6-digit code. It is removed automatically after a trainer registers with it, or after 7 days
          if unused.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-accent rounded-lg px-4 py-2" onClick={() => generateCode()}>
            Generate code
          </button>
          {inviteCode && (
            <button
              type="button"
              className="rounded-lg border px-4 py-2"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteCode);
                setStatus("Code copied to clipboard.");
              }}
            >
              Copy code
            </button>
          )}
        </div>

        <p className="mt-4 font-mono text-2xl tracking-widest">{inviteCode ?? "—"}</p>
        {expiresAt && inviteCode && (
          <p className="mt-2 text-xs opacity-70">
            Expires {formatDateTime(expiresAt)}
          </p>
        )}
        {!inviteCode && (
          <p className="mt-2 text-sm opacity-70">No active invite code. Generate one to invite a trainer.</p>
        )}
        {status && <p className="mt-3 text-sm">{status}</p>}

        <button
          type="button"
          className="mt-6 w-full rounded-lg border py-3 font-medium"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function DeleteStoreConfirmModal({
  storeName,
  confirmText,
  onConfirmTextChange,
  busy,
  error,
  onClose,
  onConfirmDeletion,
}: {
  storeName: string;
  confirmText: string;
  onConfirmTextChange: (v: string) => void;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirmDeletion: () => void | Promise<void>;
}) {
  const nameMatches =
    storeName.trim().length > 0 && confirmText.trim() === storeName.trim();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-store-dialog-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border bg-card p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="delete-store-dialog-title" className="mb-2 text-lg font-semibold text-rose-900 dark:text-rose-200">
          Delete this store?
        </h3>
        <p className="mb-4 text-sm text-foreground">
          This permanently deletes the store and everything in it (users, positions, trainees, progress,
          announcements). You cannot undo this.
        </p>
        <p className="mb-3 text-sm">
          To confirm, type the store name exactly as shown:
        </p>
        <p className="mb-4 rounded-lg border bg-slate-100 px-3 py-2 font-medium dark:bg-slate-800">
          {storeName || "(unknown)"}
        </p>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide opacity-70">
          Store name
        </label>
        <input
          autoFocus
          value={confirmText}
          onChange={(e) => onConfirmTextChange(e.target.value)}
          placeholder="Type the full store name"
          className="mb-3 w-full rounded-lg border bg-background p-3"
          autoComplete="off"
        />
        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm font-medium"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!nameMatches || busy}
            onClick={() => void onConfirmDeletion()}
          >
            {busy ? "Deleting…" : "Confirm deletion"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteTraineeConfirmModal({
  traineeName,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  traineeName: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-trainee-dialog-title"
      onMouseDown={(e) => {
        if (busy) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border bg-card p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3
          id="delete-trainee-dialog-title"
          className="mb-2 text-lg font-semibold text-rose-900 dark:text-rose-200"
        >
          Delete this trainee?
        </h3>
        <p className="mb-4 text-sm text-foreground">
          <strong className="font-semibold">{traineeName}</strong> will be removed from your store.
          All checklist progress for this trainee is permanently deleted and cannot be recovered.
        </p>
        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm font-medium"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy ? "Deleting…" : "Delete trainee"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({
  user,
  accountDetails,
  storeDetails,
  teamMembers,
  positions,
  dashboard,
  category,
  appearance,
  appearanceReady,
  systemPrefersDark,
  setCategory,
  setAppearance,
  refreshCore,
  onSessionRefresh,
  onLogout,
}: {
  user: AppUser;
  accountDetails: AccountDetails | null;
  storeDetails: StoreDetails | null;
  teamMembers: TeamMember[];
  positions: Position[];
  dashboard: DashboardRow[];
  category: SettingsCategory;
  appearance: AppearanceSettings;
  appearanceReady: boolean;
  systemPrefersDark: boolean;
  setCategory: (value: SettingsCategory) => void;
  setAppearance: Dispatch<SetStateAction<AppearanceSettings>>;
  refreshCore: () => Promise<void>;
  onSessionRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const effectiveRole: Role = accountDetails?.role ?? user.role;
  const allow = useCallback(
    (permission: Permission) => can(effectiveRole, permission),
    [effectiveRole],
  );
  const canViewStore = allow("settings.store.view");
  const canRenameStore = allow("settings.store.rename");
  const canDeleteStore = allow("settings.store.delete");
  const canManageTraining = allow("settings.trainingSetup");
  const canManageMembers = allow("settings.trainers");
  const canDeleteTrainees = allow("trainees.delete");
  const canCreateTrainees = allow("trainees.create");

  const [storeNameDraft, setStoreNameDraft] = useState("");
  const [settingsErr, setSettingsErr] = useState("");
  const [trainerInviteModalOpen, setTrainerInviteModalOpen] = useState(false);
  const [teamActionError, setTeamActionError] = useState("");
  const [deleteStoreErr, setDeleteStoreErr] = useState("");
  const [deleteStoreModalOpen, setDeleteStoreModalOpen] = useState(false);
  const [deleteStoreNameConfirm, setDeleteStoreNameConfirm] = useState("");
  const [deleteStoreBusy, setDeleteStoreBusy] = useState(false);
  const [traineeActionError, setTraineeActionError] = useState("");
  const [deletingTraineeId, setDeletingTraineeId] = useState<string | null>(null);
  const [traineePendingDelete, setTraineePendingDelete] = useState<DashboardRow | null>(null);

  const categories: SettingsCategory[] = [
    "account",
    "appearance",
    ...(canViewStore ? (["store"] as SettingsCategory[]) : []),
    ...(canManageTraining ? (["trainingSetup"] as SettingsCategory[]) : []),
    ...(canManageMembers ? (["trainers"] as SettingsCategory[]) : []),
    ...(canDeleteTrainees ? (["traineeManagement"] as SettingsCategory[]) : []),
  ];

  return (
    <section className="rounded-xl bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">Store Management & Settings</h2>
      <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
        <aside className="space-y-2 rounded-lg border p-2">
          {categories.map((key) => (
            <button
              key={key}
              onClick={() => {
                setCategory(key);
                if (key === "store") {
                  setStoreNameDraft(storeDetails?.name ?? "");
                }
              }}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${category === key ? "btn-accent" : "bg-slate-100 dark:bg-slate-700"}`}
            >
              {key === "account" && "Account"}
              {key === "store" && "Store Details"}
              {key === "appearance" && "Appearance"}
              {key === "trainingSetup" && "Position Setup"}
              {key === "trainers" && "User Management"}
              {key === "traineeManagement" && "Trainee Management"}
            </button>
          ))}
        </aside>

        <div className="rounded-lg border p-3">
          {category === "account" && (
            <div className="space-y-2 text-sm">
              <p><strong>Name:</strong> {accountDetails?.name ?? user.name}</p>
              <p><strong>Email:</strong> {accountDetails?.email ?? user.email}</p>
              <p><strong>Role:</strong> {accountDetails?.role ?? user.role}</p>
              <p><strong>Store:</strong> {accountDetails?.storeName ?? user.storeName}</p>
              <p>
                <strong>Account Created:</strong>{" "}
                {accountDetails?.createdAt ? formatDateTime(accountDetails.createdAt) : "-"}
              </p>
              <button className="rounded-lg bg-rose-600 px-4 py-2 text-white" onClick={onLogout}>
                Log Out
              </button>
            </div>
          )}

          {category === "store" && canViewStore && (
            <div className="space-y-3 text-sm">
              <p><strong>Store Name:</strong> {storeDetails?.name ?? "-"}</p>
              <p>
                <strong>Created:</strong>{" "}
                {storeDetails?.createdAt ? formatDateTime(storeDetails.createdAt) : "-"}
              </p>
              <p>
                <strong>Users:</strong> {storeDetails?._count.users ?? 0} |{" "}
                <strong>Positions:</strong> {storeDetails?._count.positions ?? 0} |{" "}
                <strong>Trainees:</strong> {storeDetails?._count.trainees ?? 0}
              </p>
              {canRenameStore ? (
                <form
                  className="space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setSettingsErr("");
                    try {
                      await api("/api/settings/store-details", {
                        method: "PUT",
                        body: JSON.stringify({ name: storeNameDraft }),
                      });
                      await refreshCore();
                    } catch (error) {
                      setSettingsErr((error as Error).message);
                    }
                  }}
                >
                  <input
                    value={storeNameDraft}
                    onChange={(e) => setStoreNameDraft(e.target.value)}
                    className="w-full rounded-lg border p-3"
                    placeholder="Update store name"
                    required
                  />
                  {settingsErr && <p className="text-rose-600">{settingsErr}</p>}
                  <button className="btn-accent rounded-lg px-4 py-2">Save Store Name</button>
                </form>
              ) : (
                <p className="text-xs opacity-70">
                  Only the store owner can rename this store.
                </p>
              )}

              {canDeleteStore && (
                <div className="mt-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                  <p className="mb-2 font-semibold">Danger zone</p>
                  <p className="mb-2">
                    Deleting the store permanently removes the store and all users,
                    positions, trainees, progress, and announcements. This cannot be undone.
                  </p>
                  <button
                    type="button"
                    className="rounded-lg bg-rose-600 px-4 py-2 text-white hover:bg-rose-700"
                    onClick={() => {
                      setDeleteStoreErr("");
                      setDeleteStoreNameConfirm("");
                      setDeleteStoreModalOpen(true);
                    }}
                  >
                    Delete store
                  </button>

                  {deleteStoreModalOpen && (
                    <DeleteStoreConfirmModal
                      storeName={storeDetails?.name ?? ""}
                      confirmText={deleteStoreNameConfirm}
                      onConfirmTextChange={setDeleteStoreNameConfirm}
                      busy={deleteStoreBusy}
                      error={deleteStoreErr}
                      onClose={() => {
                        setDeleteStoreModalOpen(false);
                        setDeleteStoreNameConfirm("");
                        setDeleteStoreErr("");
                      }}
                      onConfirmDeletion={async () => {
                        const expected = (storeDetails?.name ?? "").trim();
                        const typed = deleteStoreNameConfirm.trim();
                        if (!expected || typed !== expected) {
                          setDeleteStoreErr("The name you entered does not match this store.");
                          return;
                        }
                        setDeleteStoreErr("");
                        setDeleteStoreBusy(true);
                        try {
                          await api("/api/settings/store-details", { method: "DELETE" });
                          setDeleteStoreModalOpen(false);
                          await onLogout();
                        } catch (error) {
                          setDeleteStoreErr((error as Error).message);
                        } finally {
                          setDeleteStoreBusy(false);
                        }
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {category === "appearance" && (
            <div className="space-y-3 text-sm">
              {!appearanceReady && (
                <p className="text-xs opacity-70">Loading your saved appearance…</p>
              )}
              {(() => {
                const effectiveDark = appearance.followSystemTheme
                  ? systemPrefersDark
                  : appearance.darkMode;
                const switchShowsDark = appearance.followSystemTheme
                  ? systemPrefersDark
                  : appearance.darkMode;
                const manualLocked = !appearanceReady || appearance.followSystemTheme;
                return (
                  <div
                    className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${!appearanceReady ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <span className="font-medium">
                      {effectiveDark ? "Dark mode" : "Light mode"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={switchShowsDark}
                      aria-label={effectiveDark ? "Dark mode" : "Light mode"}
                      disabled={manualLocked}
                      onClick={() =>
                        setAppearance((prev) => ({ ...prev, darkMode: !prev.darkMode }))
                      }
                      className={`relative h-10 w-[4.5rem] shrink-0 overflow-hidden rounded-full border-2 transition-colors max-sm:h-9 max-sm:w-16 ${
                        manualLocked
                          ? "cursor-not-allowed opacity-45"
                          : "cursor-pointer touch-manipulation"
                      } ${
                        switchShowsDark
                          ? "border-indigo-500/60 bg-indigo-950/40"
                          : "border-amber-300/80 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-950/30"
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform duration-200 ease-out dark:bg-slate-800 dark:ring-white/10 max-sm:top-0.5 max-sm:left-0.5 max-sm:h-7 max-sm:w-7 ${
                          switchShowsDark
                            ? "translate-x-[2rem] max-sm:translate-x-[1.75rem]"
                            : "translate-x-0"
                        }`}
                      >
                        {switchShowsDark ? (
                          <MoonIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-300 max-sm:h-3 max-sm:w-3" />
                        ) : (
                          <SunIcon className="h-4 w-4 text-amber-600 max-sm:h-3 max-sm:w-3" />
                        )}
                      </span>
                      {/* Desktop-only track hints — hidden on small screens so icons/touches aren’t crowded */}
                      <span className="pointer-events-none absolute inset-0 z-0 hidden items-center justify-between px-2.5 opacity-70 sm:flex">
                        <SunIcon className="h-3.5 w-3.5 text-amber-700/90 dark:text-amber-300/90" />
                        <MoonIcon className="h-3.5 w-3.5 text-indigo-600/90 dark:text-indigo-300/90" />
                      </span>
                    </button>
                  </div>
                );
              })()}
              <div
                className={`ml-6 border-l-2 border-slate-200 pl-4 dark:border-slate-600 ${!appearanceReady ? "pointer-events-none opacity-50" : ""}`}
              >
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <span className="text-sm">Follow system setting</span>
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={appearance.followSystemTheme}
                    disabled={!appearanceReady}
                    onChange={() =>
                      setAppearance((prev) => ({
                        ...prev,
                        followSystemTheme: !prev.followSystemTheme,
                      }))
                    }
                  />
                </label>
                <p className="mt-1 text-xs opacity-70">
                  Match light or dark to your device’s current appearance. When on, the toggle above
                  follows the system and cannot be edited.
                </p>
              </div>
              <label className={`block ${!appearanceReady ? "pointer-events-none opacity-50" : ""}`}>
                <span>Font size</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-card p-2 text-foreground dark:border-slate-600"
                  value={appearance.fontScale}
                  disabled={!appearanceReady}
                  onChange={(e) =>
                    setAppearance((prev) => ({ ...prev, fontScale: Number(e.target.value) }))
                  }
                >
                  <option value={0.9}>Small</option>
                  <option value={1}>Default</option>
                  <option value={1.1}>Large</option>
                  <option value={1.2}>Extra Large</option>
                </select>
              </label>
              <label className={`block ${!appearanceReady ? "pointer-events-none opacity-50" : ""}`}>
                <span>Accent color</span>
                <input
                  type="color"
                  className="mt-1 h-10 w-full rounded-lg border p-1"
                  value={appearance.accent}
                  disabled={!appearanceReady}
                  onChange={(e) => setAppearance((prev) => ({ ...prev, accent: e.target.value }))}
                />
              </label>
              <label className={`flex items-center justify-between gap-2 ${!appearanceReady ? "pointer-events-none opacity-50" : ""}`}>
                <span>Compact cards</span>
                <input
                  type="checkbox"
                  checked={appearance.compactCards}
                  disabled={!appearanceReady}
                  onChange={() =>
                    setAppearance((prev) => ({ ...prev, compactCards: !prev.compactCards }))
                  }
                />
              </label>
              <p className="text-xs opacity-70">
                Saved for your account and synced across devices when you’re signed in.
              </p>
            </div>
          )}

          {category === "trainingSetup" && canManageTraining && (
            <TrainingSetupSection positions={positions} onRefresh={refreshCore} />
          )}

          {category === "trainers" && canManageMembers && (
            <>
              <div className="mb-4">
                <button
                  type="button"
                  className="btn-accent rounded-lg px-4 py-3 font-medium"
                  onClick={() => setTrainerInviteModalOpen(true)}
                >
                  Invite Trainer
                </button>
              </div>
              <TrainerInviteModal
                open={trainerInviteModalOpen}
                onClose={() => setTrainerInviteModalOpen(false)}
                onAfterChange={refreshCore}
              />
              <p className="mb-2 text-sm font-semibold">Team members</p>
              {teamActionError && (
                <p className="mb-2 text-sm text-rose-600">{teamActionError}</p>
              )}
              <div className="space-y-3 text-sm">
              {teamMembers.length === 0 && (
                <p className="opacity-70">
                  Loading team members… If this keeps saying empty, make sure the
                  server is running the latest Prisma client.
                </p>
              )}
              {teamMembers.map((member) => {
                const isSelf = member.id === user.id;
                const isOwner = member.role === "OWNER";
                const roleLocked = isSelf || isOwner;
                return (
                <div key={member.id} className="rounded-lg border p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">
                        {member.name}
                        {isSelf && (
                          <span className="ml-2 text-xs font-normal opacity-70">(you)</span>
                        )}
                      </p>
                      <p>{member.email}</p>
                      {member.role === "TRAINER" && (
                        <p>
                          Invite code used: {member.trainerInviteCodeUsed ?? "—"}
                        </p>
                      )}
                      <p className="opacity-70">
                        Joined {formatDateTime(member.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      <label
                        className={`flex flex-col gap-1 text-xs font-medium ${roleLocked ? "opacity-50" : "opacity-80"}`}
                      >
                        Role
                        {isOwner ? (
                          <span className="min-w-[10rem] rounded-lg border bg-card px-3 py-2 text-sm text-foreground">
                            {roleLabel("OWNER")}
                          </span>
                        ) : (
                          <select
                            disabled={isSelf}
                            className={`min-w-[10rem] rounded-lg border border-slate-200 bg-card px-3 py-2 text-sm text-foreground dark:border-slate-600 ${isSelf ? "cursor-not-allowed opacity-60" : ""}`}
                            value={member.role}
                            onChange={async (e) => {
                              if (isSelf) return;
                              const next = e.target.value;
                              if (next !== "ADMIN" && next !== "TRAINER") return;
                              if (next === member.role) return;
                              setTeamActionError("");
                              try {
                                await api(`/api/settings/trainers/${member.id}`, {
                                  method: "PATCH",
                                  body: JSON.stringify({ role: next }),
                                });
                                await refreshCore();
                                if (member.id === user.id) {
                                  await onSessionRefresh();
                                }
                              } catch (err) {
                                setTeamActionError((err as Error).message);
                              }
                            }}
                          >
                            <option value="ADMIN">Admin</option>
                            <option value="TRAINER">Trainer</option>
                          </select>
                        )}
                      </label>
                      <button
                        type="button"
                        disabled={roleLocked}
                        className={
                          roleLocked
                            ? "cursor-not-allowed rounded-lg border border-neutral-300 bg-neutral-200 px-3 py-2 text-sm font-medium text-neutral-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-400"
                            : "rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
                        }
                        onClick={async () => {
                          if (roleLocked) return;
                          setTeamActionError("");
                          try {
                            await api(`/api/settings/trainers/${member.id}`, {
                              method: "DELETE",
                            });
                            await refreshCore();
                            if (member.id === user.id) {
                              await onLogout();
                            }
                          } catch (err) {
                            setTeamActionError((err as Error).message);
                          }
                        }}
                      >
                        {member.role === "TRAINER"
                          ? "Remove Trainer"
                          : member.role === "OWNER"
                            ? "Remove owner"
                            : "Remove admin"}
                      </button>
                      {isSelf && (
                        <p className="max-w-[14rem] text-right text-xs text-neutral-500 dark:text-neutral-400">
                          You can&apos;t change your own role or remove yourself here.
                        </p>
                      )}
                      {isOwner && !isSelf && (
                        <p className="max-w-[14rem] text-right text-xs text-neutral-500 dark:text-neutral-400">
                          The store owner cannot be reassigned or removed here.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
              })}
              </div>
            </>
          )}

          {category === "traineeManagement" && canDeleteTrainees && (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Trainees</p>
                  <p className="mt-1 text-xs opacity-70">
                    Review everyone currently in training and remove trainees who should no
                    longer appear on the dashboard. Deleting a trainee permanently removes
                    their progress.
                  </p>
                </div>
                {canCreateTrainees ? <AddTraineeModalFlow onRefresh={refreshCore} /> : null}
              </div>
              {traineeActionError && !traineePendingDelete && (
                <p className="mb-2 text-sm text-rose-600">{traineeActionError}</p>
              )}
              <div className="space-y-3 text-sm">
                {dashboard.length === 0 && (
                  <p className="opacity-70">No trainees yet.</p>
                )}
                {dashboard.map((row) => {
                  const busy = deletingTraineeId === row.id;
                  return (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="truncate">{row.name}</strong>
                          <span className="shrink-0 text-sm font-semibold">
                            {row.percentage}%
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs opacity-70">
                          Completed {row.positionsFullyComplete}/{row.storePositionCount} ·
                          Remaining {row.remainingPositions}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Delete trainee ${row.name}`}
                        title={`Delete ${row.name}`}
                        disabled={busy}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => {
                          if (busy) return;
                          setTraineeActionError("");
                          setTraineePendingDelete(row);
                        }}
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
      {traineePendingDelete !== null && (
        <DeleteTraineeConfirmModal
          traineeName={traineePendingDelete.name}
          busy={deletingTraineeId === traineePendingDelete.id}
          error={traineeActionError}
          onClose={() => {
            if (deletingTraineeId === traineePendingDelete.id) return;
            setTraineePendingDelete(null);
            setTraineeActionError("");
          }}
          onConfirm={async () => {
            const row = traineePendingDelete;
            if (!row || deletingTraineeId) return;
            setTraineeActionError("");
            setDeletingTraineeId(row.id);
            try {
              await api(`/api/trainees/${row.id}`, { method: "DELETE" });
              setTraineePendingDelete(null);
              await refreshCore();
            } catch (err) {
              setTraineeActionError((err as Error).message);
            } finally {
              setDeletingTraineeId(null);
            }
          }}
        />
      )}
    </section>
  );
}

