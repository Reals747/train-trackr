"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format-datetime";
import { can } from "@/lib/permissions";
import LoadingScreen from "@/components/LoadingScreen";
import { ExpandIcon, TasksGrid } from "@/components/TasksGrid";
import { TasksTodayOverview } from "@/components/TasksTodayOverview";
import { api } from "./_home/api";
import { ACCENT_SWATCHES, DEFAULT_APPEARANCE } from "./_home/appearance";
import { ActivityHistoryIcon, SettingsGearIcon } from "./_home/icons";
import { ExpandableHeaderButton } from "./_home/ExpandableHeaderButton";
import { ExpandableNavTab } from "./_home/ExpandableNavTab";
import { AuthScreen } from "./_home/AuthScreen";
import { ProfileToggle } from "./_home/ProfileToggle";
import { SwitchProfileConfirmModal } from "./_home/settings-modals";
import { useProfileSwitch } from "./_home/useProfileSwitch";
import { withProfileQuery } from "./_home/profile-query";
import { SettingsPanel } from "./_home/SettingsPanel";
import { TraineeDashboardModal } from "./_home/TraineeDashboardModal";
import { UnderDevelopmentNotice } from "./_home/UnderDevelopmentNotice";
import type {
  AccountDetails,
  ActivityLog,
  AnnouncementRow,
  AppearanceSettings,
  ActiveProfile,
  AppUser,
  DashboardRow,
  Position,
  SettingsCategory,
  StoreDetails,
  StoreProfileRow,
  TeamMember,
  Trainee,
} from "./_home/types";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  /** False until the initial `/api/auth/me` attempt finishes (success or not). Avoids flashing the login UI while the session is still unknown. */
  const [sessionResolved, setSessionResolved] = useState(false);
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
  const [storeProfiles, setStoreProfiles] = useState<StoreProfileRow[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- AnnouncementsSection is temporarily hidden; keep state/fetcher so we can re-enable quickly.
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [appearanceReady, setAppearanceReady] = useState(false);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false,
  );
  const [activeProfile, setActiveProfile] = useState<ActiveProfile>("FOH");

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

  const activeProfileRef = useRef(activeProfile);
  activeProfileRef.current = activeProfile;

  const refreshCore = useCallback(async () => {
    const pq = (path: string) => withProfileQuery(path, activeProfileRef.current);
    const [positionsRes, traineesRes, dashboardRes, accountRes, annRes, profilesRes] =
      await Promise.all([
      api<{ positions: Position[] }>(pq("/api/positions")),
      api<{ trainees: Trainee[] }>(pq("/api/trainees")),
      api<{ trainees: DashboardRow[] }>(pq("/api/dashboard")),
      api<{ account: AccountDetails }>("/api/settings/account"),
      api<{ announcements: AnnouncementRow[] }>("/api/announcements"),
      api<{ profiles: StoreProfileRow[] }>("/api/store-profiles"),
    ]);
    setPositions(positionsRes.positions);
    setTrainees(traineesRes.trainees);
    setDashboard(dashboardRes.trainees);
    setAccountDetails(accountRes.account);
    setAnnouncements(annRes.announcements);
    setStoreProfiles(profilesRes.profiles);
    setActiveProfile((prev) => {
      if (profilesRes.profiles.some((profile) => profile.key === prev)) return prev;
      return profilesRes.profiles[0]?.key ?? "FOH";
    });

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

  const {
    profileSaving,
    pendingProfileKey,
    pendingProfileName,
    profileSwitchError,
    requestProfileSwitch,
    confirmPendingProfileSwitch,
    cancelPendingProfileSwitch,
  } = useProfileSwitch({
    role: user?.role,
    activeProfile,
    setActiveProfile,
    storeProfiles,
    saveProfile: (body) =>
      api("/api/settings/profile", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: async (next) => {
      setUser((u) => (u ? { ...u, activeProfile: next } : u));
      await refreshCoreRef.current();
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let authedUser: AppUser | null = null;
      let authDone = false;
      try {
        const me = await api<{ user: AppUser }>("/api/auth/me");
        authedUser = me.user;
        authDone = true;
      } catch {
        authedUser = null;
        authDone = true;
      }
      if (cancelled || !authDone) return;
      setUser(authedUser);
      if (authedUser?.activeProfile) {
        setActiveProfile(authedUser.activeProfile);
      }
      setSessionResolved(true);
      if (authedUser) {
        void refreshCoreRef.current().catch(() => undefined);
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
        if (!cancelled) {
          const lo = res.appearance.accent.trim().toLowerCase();
          const fromSwatch = ACCENT_SWATCHES.find((s) => s.hex.toLowerCase() === lo);
          const accent =
            lo === "#dc2626"
              ? "#e51636"
              : fromSwatch
                ? fromSwatch.hex
                : res.appearance.accent;
          setAppearance({ ...res.appearance, accent });
        }
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
    if (!user) return;
    void refreshCore().catch(() => undefined);
  }, [activeProfile, user?.id, refreshCore]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (user) {
        refreshCore().catch(() => undefined);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [user, refreshCore]);

  const isTraineeChecklistComplete = useCallback((row: DashboardRow) => row.percentage >= 100, []);

  const filteredDashboard = useMemo(
    () =>
      dashboard
        .filter((row) => row.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
          const aDone = isTraineeChecklistComplete(a);
          const bDone = isTraineeChecklistComplete(b);
          if (aDone === bDone) return 0;
          return aDone ? 1 : -1;
        }),
    [dashboard, search, isTraineeChecklistComplete],
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

  useEffect(() => {
    if (!canViewActivity || tab !== "activity") return;
    void api<{ logs: ActivityLog[] }>("/api/activity")
      .then((res) => setActivity(res.logs))
      .catch(() => setActivity([]));
  }, [canViewActivity, tab]);

  if (!sessionResolved) {
    return <LoadingScreen />;
  }

  if (!user) {
    return (
      <AuthScreen
        onLoggedIn={(nextUser) => {
          setUser(nextUser);
          if (nextUser.activeProfile) setActiveProfile(nextUser.activeProfile);
          void refreshCore().catch(() => undefined);
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
            <h1 className="text-2xl font-bold">Train Trackr</h1>
            <p className="text-sm opacity-75">{user.storeName} - {user.name} ({user.role})</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ProfileToggle
              value={activeProfile}
              onChange={requestProfileSwitch}
              profiles={storeProfiles}
              disabled={profileSaving}
            />
            {canViewActivity ? (
              <ExpandableHeaderButton
                label="Activity Feed"
                active={tab === "activity"}
                onClick={() => setTab("activity")}
                icon={<ActivityHistoryIcon className="h-5 w-5" />}
              />
            ) : null}
            <ExpandableHeaderButton
              label="Settings"
              active={tab === "settings"}
              onClick={() => {
                setTab("settings");
                setSettingsCategory("account");
              }}
              icon={<SettingsGearIcon className="h-5 w-5" />}
            />
          </div>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 rounded-xl bg-card p-2 shadow-sm sm:flex-nowrap">
        {(
          [
            ["dashboard", "Dashboard"],
            ["workflow", "Training"],
            ["tasks", "Tasks"],
            ["schedule", "Schedule"],
            // ["trainees", "Trainees"], — hidden; restore with TraineePanel block below
          ] as const
        ).map(([key, label]) => (
          <ExpandableNavTab
            key={key}
            label={label}
            active={tab === key}
            onClick={() => setTab(key)}
          />
        ))}
      </nav>

      {tab === "dashboard" && (
        <>
          {/* Announcements section temporarily hidden — uncomment the <AnnouncementsSection /> block
              below to restore it. The API routes, state, and component remain intact so no progress is lost.
          <AnnouncementsSection
            user={user}
            accountDetails={accountDetails}
            announcements={announcements}
            canComment={canTrain}
            onRefresh={refreshCore}
          />
          */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <section className="rounded-xl bg-card p-4 shadow-sm lg:min-w-0 lg:flex-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Tasks Overview</h2>
            </div>
            <TasksTodayOverview activeProfile={activeProfile} />
          </section>
          <section className="rounded-xl bg-card p-4 shadow-sm lg:min-w-0 lg:flex-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Trainee progress</h2>
              {canOpenTraineeManagement && (
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
              )}
            </div>
            <input
              className="mb-3 w-full rounded-lg border p-3"
              placeholder="Search trainees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="space-y-3">
              {filteredDashboard.map((row) => {
                const isComplete = isTraineeChecklistComplete(row);
                return (
                  <button
                    key={row.id}
                    type="button"
                    className={`w-full rounded-lg p-3 text-left text-sm font-medium transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-slate-400 ${
                      isComplete
                        ? "bg-emerald-50 text-slate-800 hover:bg-emerald-100/90 dark:bg-emerald-950/35 dark:text-slate-200 dark:hover:bg-emerald-950/50"
                        : "bg-slate-100 text-slate-900 hover:bg-slate-200/90 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                    }`}
                    onClick={() => setDashboardModalTraineeId(row.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="flex items-center gap-2">
                        <span>{row.name}</span>
                        {isComplete && (
                          <span className="text-xs italic font-normal opacity-80">Trained</span>
                        )}
                      </strong>
                      <span className="shrink-0 text-sm font-semibold">{row.percentage}%</span>
                    </div>
                    <p className="text-sm">
                      Completed {row.positionsFullyComplete}/{row.storePositionCount} Remaining{" "}
                      {row.remainingPositions}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
          </div>
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
                router.push(`/workflow/${selectedTraineeId}`);
              }}
            >
              Load Checklist
            </button>
          </div>
        </section>
      )}

      {tab === "tasks" && (
        <section className="rounded-xl bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Tasks</h2>
            <button
              type="button"
              onClick={() => router.push(`/tasks?profile=${encodeURIComponent(activeProfile)}`)}
              aria-label="Open tasks in full page"
              title="Open in full page"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200/90 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            >
              <ExpandIcon className="h-4 w-4" />
              Expand
            </button>
          </div>
          <TasksGrid activeProfile={activeProfile} />
        </section>
      )}

      {tab === "schedule" && (
        <section className="rounded-xl bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Schedule</h2>
          <UnderDevelopmentNotice />
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
          <h2 className="mb-1 text-lg font-semibold">Activity Feed</h2>
          <p className="mb-3 text-sm opacity-75">
            Latest 20 store actions. Older entries are removed automatically.
          </p>
          <div className="space-y-3">
            {activity.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm opacity-70">
                No activity yet. Changes across training, tasks, settings, and team
                management will appear here.
              </p>
            ) : (
              activity.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg bg-slate-100 p-3 text-sm text-slate-900 dark:bg-slate-700 dark:text-slate-100"
                >
                  <p className="font-medium">{log.message}</p>
                  <p className="mt-0.5 text-xs opacity-70">
                    {log.actor} • {formatDateTime(log.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {tab === "settings" && (
        <SettingsPanel
          user={user}
          activeProfile={activeProfile}
          setUser={setUser}
          accountDetails={accountDetails}
          setAccountDetails={setAccountDetails}
          storeDetails={storeDetails}
          storeProfiles={storeProfiles}
          teamMembers={teamMembers}
          setTeamMembers={setTeamMembers}
          positions={positions}
          setPositions={setPositions}
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
          key={dashboardModalRow.id}
          row={dashboardModalRow}
          onClose={() => setDashboardModalTraineeId(null)}
        />
      )}

      {pendingProfileKey && (
        <SwitchProfileConfirmModal
          targetProfileName={pendingProfileName}
          busy={profileSaving}
          error={profileSwitchError}
          onClose={cancelPendingProfileSwitch}
          onConfirm={confirmPendingProfileSwitch}
        />
      )}
    </main>
  );
}
