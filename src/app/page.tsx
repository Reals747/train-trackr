"use client";

import {
  Dispatch,
  FormEvent,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
type DashboardRow = {
  id: string;
  name: string;
  percentage: number;
  completedItems: number;
  remainingItems: number;
  totalItems: number;
  positions: string[];
};
type ActivityLog = { id: string; message: string; actor: string; createdAt: string };
type ProgressItem = {
  id: string;
  text: string;
  description: string | null;
  completed: boolean;
  trainerName: string | null;
  notes: string | null;
  completedAt: string | null;
};
type AuthMode = "login" | "register-admin" | "register-trainer";
type SettingsCategory = "account" | "store" | "appearance" | "trainers" | "trainingSetup";
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

export default function Home() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [error, setError] = useState<string>("");
  const [tab, setTab] = useState("dashboard");
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>("account");
  const [positions, setPositions] = useState<Position[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [dashboard, setDashboard] = useState<DashboardRow[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [selectedTraineeId, setSelectedTraineeId] = useState("");
  const [selectedPositionId, setSelectedPositionId] = useState("");
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [search, setSearch] = useState("");
  const [accountDetails, setAccountDetails] = useState<AccountDetails | null>(null);
  const [storeDetails, setStoreDetails] = useState<StoreDetails | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [appearance, setAppearance] = useState<AppearanceSettings>({
    darkMode: false,
    fontScale: 1,
    accent: "#2563eb",
    compactCards: false,
  });

  const canTrain = can(user?.role, "workflow.edit");

  const applyStoredAppearance = useCallback((targetUser: AppUser) => {
    const saved = localStorage.getItem(`appearance:${targetUser.id}`);
    if (!saved) {
      setAppearance({ darkMode: false, fontScale: 1, accent: "#2563eb", compactCards: false });
      return;
    }
    try {
      setAppearance(JSON.parse(saved) as AppearanceSettings);
    } catch {
      setAppearance({ darkMode: false, fontScale: 1, accent: "#2563eb", compactCards: false });
    }
  }, []);

  const refreshCore = useCallback(async () => {
    const [positionsRes, traineesRes, dashboardRes, activityRes, accountRes, annRes] =
      await Promise.all([
        api<{ positions: Position[] }>("/api/positions"),
        api<{ trainees: Trainee[] }>("/api/trainees"),
        api<{ trainees: DashboardRow[] }>("/api/dashboard"),
        api<{ logs: ActivityLog[] }>("/api/activity"),
        api<{ account: AccountDetails }>("/api/settings/account"),
        api<{ announcements: AnnouncementRow[] }>("/api/announcements"),
      ]);
    setPositions(positionsRes.positions);
    setTrainees(traineesRes.trainees);
    setDashboard(dashboardRes.trainees);
    setActivity(activityRes.logs);
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

  async function refreshProgress(traineeId: string, positionId: string) {
    if (!traineeId || !positionId) {
      setProgressItems([]);
      return;
    }
    const res = await api<{ items: ProgressItem[] }>(
      `/api/progress?traineeId=${traineeId}&positionId=${positionId}`,
    );
    setProgressItems(res.items);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api<{ user: AppUser }>("/api/auth/me");
        if (cancelled) return;
        setUser(me.user);
        applyStoredAppearance(me.user);
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
  }, [applyStoredAppearance]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", appearance.darkMode);
    document.documentElement.style.setProperty("--accent", appearance.accent);
    document.documentElement.style.setProperty("--font-scale", String(appearance.fontScale));
    if (user) {
      localStorage.setItem(`appearance:${user.id}`, JSON.stringify(appearance));
    }
  }, [appearance, user]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (user) {
        refreshCore().catch(() => undefined);
        refreshProgress(selectedTraineeId, selectedPositionId).catch(() => undefined);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [user, selectedTraineeId, selectedPositionId, refreshCore]);

  const filteredDashboard = useMemo(
    () => dashboard.filter((row) => row.name.toLowerCase().includes(search.toLowerCase())),
    [dashboard, search],
  );

  if (!user) {
    return (
      <AuthScreen
        onLoggedIn={(nextUser) => {
          setUser(nextUser);
          applyStoredAppearance(nextUser);
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
            <button
              className="rounded-lg border px-3 py-2"
              aria-label="Open settings"
              onClick={() => {
                setTab("settings");
                setSettingsCategory("account");
              }}
            >
              ⚙
            </button>
          </div>
        </div>
      </header>

      <nav className="grid grid-cols-2 gap-2 rounded-xl bg-card p-2 shadow-sm sm:grid-cols-4">
        {["dashboard", "workflow", "trainees", "activity"].map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-3 py-3 text-sm font-medium ${tab === key ? "btn-accent" : "bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-100"}`}
          >
            {key}
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
            <h2 className="mb-3 text-lg font-semibold">Trainee progress</h2>
            <input
              className="mb-3 w-full rounded-lg border p-3"
              placeholder="Search trainees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="space-y-3">
              {filteredDashboard.map((row) => (
                <div key={row.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <strong>{row.name}</strong>
                    <span className="text-sm font-semibold">{row.percentage}%</span>
                  </div>
                  <p className="text-sm opacity-70">{row.positions.join(", ") || "No positions assigned"}</p>
                  <p className="text-sm">Done {row.completedItems} / {row.totalItems} • Remaining {row.remainingItems}</p>
                  <a className="mt-2 inline-block text-sm text-blue-600 underline" href={`/api/export/trainee/${row.id}`}>
                    Export CSV
                  </a>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {tab === "workflow" && (
        <section className="rounded-xl bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Live Training Workflow</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <select className="rounded-lg border p-3" value={selectedTraineeId} onChange={(e) => setSelectedTraineeId(e.target.value)}>
              <option value="">Select trainee</option>
              {trainees.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select className="rounded-lg border p-3" value={selectedPositionId} onChange={(e) => setSelectedPositionId(e.target.value)}>
              <option value="">Select position</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button
            className="btn-accent mt-2 rounded-lg px-4 py-3"
            onClick={() => refreshProgress(selectedTraineeId, selectedPositionId)}
          >
            Load Checklist
          </button>
          <div className="mt-3 space-y-2">
            {progressItems.map((item) => (
              <label key={item.id} className="flex items-start gap-3 rounded-lg border p-3">
                <input
                  type="checkbox"
                  checked={item.completed}
                  disabled={!canTrain}
                  className="mt-1 h-6 w-6"
                  onChange={async (e) => {
                    await api("/api/progress", {
                      method: "POST",
                      body: JSON.stringify({
                        traineeId: selectedTraineeId,
                        checklistItemId: item.id,
                        completed: e.target.checked,
                      }),
                    });
                    await refreshProgress(selectedTraineeId, selectedPositionId);
                  }}
                />
                <span className="flex-1">
                  <strong>{item.text}</strong>
                  {item.description && <p className="text-sm opacity-70">{item.description}</p>}
                  {item.completedAt && (
                    <p className="text-xs opacity-70">
                      {item.trainerName} • {new Date(item.completedAt).toLocaleString()}
                    </p>
                  )}
                </span>
              </label>
            ))}
          </div>
        </section>
      )}

      {tab === "trainees" && (
        <TraineePanel
          positions={positions}
          trainees={trainees}
          canTrain={canTrain}
          onRefresh={refreshCore}
        />
      )}

      {tab === "activity" && (
        <section className="rounded-xl bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Activity Feed</h2>
          <div className="space-y-2">
            {activity.map((log) => (
              <div key={log.id} className="rounded-lg border p-3 text-sm">
                <p>{log.message}</p>
                <p className="opacity-70">{log.actor} • {new Date(log.createdAt).toLocaleString()}</p>
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
          category={settingsCategory}
          appearance={appearance}
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
    </main>
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

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
          return { email: formData.get("email"), password: formData.get("password") };
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
          email: formData.get("email"),
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
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center p-4">
      <form onSubmit={submit} className="w-full rounded-xl bg-card p-5 shadow-sm">
        <h1 className="text-2xl font-bold">Training Tracker</h1>
        <p className="mb-4 text-sm opacity-75">Mobile-first training for fast shifts.</p>
        {mode === "register-admin" && <input name="storeName" placeholder="Store name" className="mb-2 w-full rounded-lg border p-3" required />}
        {mode !== "login" && <input name="name" placeholder="Your name" className="mb-2 w-full rounded-lg border p-3" required />}
        {mode === "register-trainer" && (
          <input
            name="inviteCode"
            placeholder="6-digit invite code"
            className="mb-2 w-full rounded-lg border p-3"
            pattern="\d{6}"
            minLength={6}
            maxLength={6}
            required
          />
        )}
        <input name="email" type="email" placeholder="Email" className="mb-2 w-full rounded-lg border p-3" required />
        <input name="password" type="password" placeholder="Password (min 8)" className="mb-2 w-full rounded-lg border p-3" required minLength={8} />
        {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}
        <button className="btn-accent w-full rounded-lg p-3 font-semibold">
          {mode === "login" ? "Sign in" : mode === "register-admin" ? "Create store" : "Create trainer account"}
        </button>
        <div className="mt-2 space-y-1 text-center text-sm">
          {mode !== "login" && (
            <button type="button" className="w-full underline" onClick={() => setMode("login")}>
              Already have an account? Sign in
            </button>
          )}
          {mode !== "register-admin" && (
            <button type="button" className="w-full underline" onClick={() => setMode("register-admin")}>
              Create a new store (owner)
            </button>
          )}
          {mode !== "register-trainer" && (
            <button type="button" className="w-full underline" onClick={() => setMode("register-trainer")}>
              Trainer create account with invite code
            </button>
          )}
        </div>
      </form>
    </main>
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
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [commentsOpen, setCommentsOpen] = useState<Record<string, boolean>>({});

  return (
    <section className="mb-4 rounded-xl bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">Announcements</h2>

      {canPostAnnouncements && (
        <form
          className="mb-4 rounded-lg border p-3"
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
              await onRefresh();
            } catch (err) {
              setPostErr((err as Error).message);
            }
          }}
        >
          <p className="mb-2 text-sm font-medium">Post an update</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="mb-2 w-full rounded-lg border p-3"
            required
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message to your team..."
            rows={3}
            className="mb-2 w-full rounded-lg border p-3"
            required
          />
          {postErr && <p className="mb-2 text-sm text-rose-600">{postErr}</p>}
          <button type="submit" className="btn-accent rounded-lg px-4 py-2">
            Publish
          </button>
        </form>
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
                  {a.authorName} • {new Date(a.createdAt).toLocaleString()}
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
                      <ul className="space-y-2 text-sm">
                        {a.comments.map((c) => (
                          <li
                            key={c.id}
                            className="rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-black shadow-sm dark:border-slate-500 dark:bg-slate-700 dark:text-slate-50 dark:shadow-md dark:shadow-black/20"
                          >
                            <p className="leading-relaxed text-black dark:text-slate-50">{c.body}</p>
                            <p className="mt-2 text-xs text-neutral-600 dark:text-slate-400">
                              {c.userName} • {new Date(c.createdAt).toLocaleString()}
                            </p>
                          </li>
                        ))}
                      </ul>
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
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [selectedPositionIds, setSelectedPositionIds] = useState<string[]>([]);
  const [err, setErr] = useState("");

  function togglePosition(positionId: string) {
    setSelectedPositionIds((prev) =>
      prev.includes(positionId)
        ? prev.filter((id) => id !== positionId)
        : [...prev, positionId],
    );
  }

  if (!canTrain) return <section className="rounded-xl bg-card p-4 shadow-sm">View only access.</section>;
  return (
    <section className="rounded-xl bg-card p-4 shadow-sm">
      <form
        className="rounded-lg border p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr("");
          try {
            await api("/api/trainees", {
              method: "POST",
              body: JSON.stringify({
                name,
                startDate,
                positionIds: selectedPositionIds,
              }),
            });
            setName("");
            setStartDate("");
            setSelectedPositionIds([]);
            await onRefresh();
          } catch (error) {
            setErr((error as Error).message);
          }
        }}
      >
        <h3 className="mb-2 font-semibold">Add Trainee</h3>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="mb-2 w-full rounded-lg border p-3"
          required
        />
        <input
          name="startDate"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="mb-2 w-full rounded-lg border p-3"
          required
        />
        <label className="mb-1 block text-sm font-medium">Assigned Positions</label>
        {positions.length === 0 ? (
          <p className="mb-2 text-sm opacity-70">Create positions first in the Admin tab.</p>
        ) : (
          <div className="mb-2 max-h-44 space-y-2 overflow-auto rounded-lg border p-2">
            {positions.map((position) => (
              <label key={position.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedPositionIds.includes(position.id)}
                  onChange={() => togglePosition(position.id)}
                  className="h-5 w-5"
                />
                <span>{position.name}</span>
              </label>
            ))}
          </div>
        )}
        {err && <p className="mb-2 text-sm text-rose-600">{err}</p>}
        <button className="btn-accent rounded-lg px-4 py-2">Save</button>
      </form>
      <div className="mt-4 space-y-2">
        {trainees.map((t) => (
          <div key={t.id} className="rounded-lg border p-3 text-sm">
            <p className="font-semibold">{t.name}</p>
            <p>{new Date(t.startDate).toLocaleDateString()}</p>
            <p className="opacity-70">
              {(t.positions || [])
                .map((x) => positions.find((p) => p.id === x.positionId)?.name || x.position.name)
                .join(", ") || "No positions"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

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
      className={`rounded-lg border text-sm ${position.hidden ? "opacity-75" : ""}`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left font-medium"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <span className="text-xs opacity-60">{expanded ? "▼" : "▶"}</span>
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
            className="rounded-lg border px-2 py-1 text-lg leading-none text-foreground"
            aria-label="Position options"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-1 min-w-[11rem] rounded-lg border bg-card py-1 shadow-lg">
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
            Expires {new Date(expiresAt).toLocaleString()}
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

function SettingsPanel({
  user,
  accountDetails,
  storeDetails,
  teamMembers,
  positions,
  category,
  appearance,
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
  category: SettingsCategory;
  appearance: AppearanceSettings;
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

  const [storeNameDraft, setStoreNameDraft] = useState("");
  const [settingsErr, setSettingsErr] = useState("");
  const [trainerInviteModalOpen, setTrainerInviteModalOpen] = useState(false);
  const [teamActionError, setTeamActionError] = useState("");
  const [deleteStoreErr, setDeleteStoreErr] = useState("");
  const [deleteStoreModalOpen, setDeleteStoreModalOpen] = useState(false);
  const [deleteStoreNameConfirm, setDeleteStoreNameConfirm] = useState("");
  const [deleteStoreBusy, setDeleteStoreBusy] = useState(false);

  const categories: SettingsCategory[] = [
    "account",
    "appearance",
    ...(canViewStore ? (["store"] as SettingsCategory[]) : []),
    ...(canManageTraining ? (["trainingSetup"] as SettingsCategory[]) : []),
    ...(canManageMembers ? (["trainers"] as SettingsCategory[]) : []),
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
              {key === "trainingSetup" && "Training Setup"}
              {key === "trainers" && "Trainer Management"}
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
                {accountDetails?.createdAt ? new Date(accountDetails.createdAt).toLocaleString() : "-"}
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
                {storeDetails?.createdAt ? new Date(storeDetails.createdAt).toLocaleString() : "-"}
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
              <label className="flex items-center justify-between gap-2">
                <span>Dark mode</span>
                <input
                  type="checkbox"
                  checked={appearance.darkMode}
                  onChange={() => setAppearance((prev) => ({ ...prev, darkMode: !prev.darkMode }))}
                />
              </label>
              <label className="block">
                <span>Font size</span>
                <select
                  className="mt-1 w-full rounded-lg border p-2"
                  value={appearance.fontScale}
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
              <label className="block">
                <span>Accent color</span>
                <input
                  type="color"
                  className="mt-1 h-10 w-full rounded-lg border p-1"
                  value={appearance.accent}
                  onChange={(e) => setAppearance((prev) => ({ ...prev, accent: e.target.value }))}
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span>Compact cards</span>
                <input
                  type="checkbox"
                  checked={appearance.compactCards}
                  onChange={() =>
                    setAppearance((prev) => ({ ...prev, compactCards: !prev.compactCards }))
                  }
                />
              </label>
              <p className="text-xs opacity-70">
                Appearance settings are saved per signed-in user on this device only.
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
                        Joined {new Date(member.createdAt).toLocaleString()}
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
                            className={`min-w-[10rem] rounded-lg border bg-card px-3 py-2 text-sm text-foreground ${isSelf ? "cursor-not-allowed opacity-60" : ""}`}
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
        </div>
      </div>
    </section>
  );
}

