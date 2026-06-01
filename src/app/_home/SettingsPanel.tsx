"use client";

import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { formatDateTime } from "@/lib/format-datetime";
import { can, roleLabel, type Permission } from "@/lib/permissions";
import { api } from "./api";
import { ACCENT_SWATCHES, accentMatchesSwatch, accentSwatchFromValue } from "./appearance";
import { AddTraineeModalFlow } from "./AddTraineeModalFlow";
import { MoonIcon, PencilIcon, SettingsGearIcon, SunIcon, TrashIcon, WarningTriangleIcon } from "./icons";
import {
  DeleteStoreConfirmModal,
  DeleteTeamMemberConfirmModal,
  DeleteTraineeConfirmModal,
  EditTraineeModal,
  ResetStoreCodeConfirmModal,
  TrainerInviteModal,
} from "./settings-modals";
import { TrainingSetupSection } from "./TrainingSetupSection";
import type {
  AccountDetails,
  AppearanceSettings,
  AppUser,
  DashboardRow,
  Position,
  Role,
  SettingsCategory,
  StoreCodeKickScope,
  StoreDetails,
  TeamMember,
} from "./types";

export function SettingsPanel({
  user,
  setUser,
  accountDetails,
  setAccountDetails,
  storeDetails,
  teamMembers,
  setTeamMembers,
  positions,
  setPositions,
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
  setUser: Dispatch<SetStateAction<AppUser | null>>;
  accountDetails: AccountDetails | null;
  setAccountDetails: Dispatch<SetStateAction<AccountDetails | null>>;
  storeDetails: StoreDetails | null;
  teamMembers: TeamMember[];
  setTeamMembers: Dispatch<SetStateAction<TeamMember[]>>;
  positions: Position[];
  setPositions: Dispatch<SetStateAction<Position[]>>;
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
  const canAssignOwner = allow("members.assignOwner");
  const canDeleteTrainees = allow("trainees.delete");
  const canCreateTrainees = allow("trainees.create");

  const [storeNameDraft, setStoreNameDraft] = useState("");
  const [storeRenameModalOpen, setStoreRenameModalOpen] = useState(false);
  const [settingsErr, setSettingsErr] = useState("");
  const [trainerInviteModalOpen, setTrainerInviteModalOpen] = useState(false);
  const [teamActionError, setTeamActionError] = useState("");
  const [memberPendingDelete, setMemberPendingDelete] = useState<TeamMember | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [deleteStoreErr, setDeleteStoreErr] = useState("");
  const [deleteStoreModalOpen, setDeleteStoreModalOpen] = useState(false);
  const [deleteStoreNameConfirm, setDeleteStoreNameConfirm] = useState("");
  const [deleteStoreBusy, setDeleteStoreBusy] = useState(false);
  const [resetStoreCodeModalOpen, setResetStoreCodeModalOpen] = useState(false);
  const [resetStoreCodeConfirm, setResetStoreCodeConfirm] = useState("");
  const [resetStoreCodeKickScope, setResetStoreCodeKickScope] =
    useState<StoreCodeKickScope>("trainers_only");
  const [resetStoreCodeBusy, setResetStoreCodeBusy] = useState(false);
  const [resetStoreCodeErr, setResetStoreCodeErr] = useState("");
  const [traineeActionError, setTraineeActionError] = useState("");
  const [deletingTraineeId, setDeletingTraineeId] = useState<string | null>(null);
  const [traineePendingDelete, setTraineePendingDelete] = useState<DashboardRow | null>(null);
  const [traineePendingEdit, setTraineePendingEdit] = useState<DashboardRow | null>(null);
  const [savingTraineeId, setSavingTraineeId] = useState<string | null>(null);
  /** Self-or-manager rename of a team-member display name. `username` is never changed. */
  const [editingMember, setEditingMember] = useState<{ id: string; name: string } | null>(null);
  const [editMemberErr, setEditMemberErr] = useState("");
  /**
   * Per-member optimistic name overrides (memberId → new name) used while a rename
   * PATCH is in-flight. The parent polls `/api/settings/trainers` every 5s and
   * overwrites `teamMembers`, so we render `(override ?? teamMembers[i].name)`
   * to make the new name stick until the backend has committed it. Each entry is
   * cleared on success (after we commit the value into `teamMembers`) or on
   * failure (causing the UI to fall back to the server value, i.e. roll back).
   * This map also drives the "Updating…" indicator.
   */
  const [pendingNameOverrides, setPendingNameOverrides] = useState<Record<string, string>>({});
  const [selfPasswordFormOpenForId, setSelfPasswordFormOpenForId] = useState<string | null>(null);
  const [selfPasswordDraft, setSelfPasswordDraft] = useState("");
  const [selfPasswordConfirmDraft, setSelfPasswordConfirmDraft] = useState("");
  const [selfPasswordBusy, setSelfPasswordBusy] = useState(false);
  const [selfPasswordError, setSelfPasswordError] = useState("");
  const [selfPasswordSuccess, setSelfPasswordSuccess] = useState("");

  useEffect(() => {
    if (!editingMember) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditingMember(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingMember]);

  useEffect(() => {
    if (!storeRenameModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSettingsErr("");
        setStoreRenameModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [storeRenameModalOpen]);

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
              <p className="flex flex-wrap items-center gap-2">
                <strong>Name:</strong>
                <span>
                  {pendingNameOverrides[user.id] ?? accountDetails?.name ?? user.name}
                </span>
                {pendingNameOverrides[user.id] !== undefined && (
                  <span className="text-xs font-normal italic opacity-70" aria-live="polite">
                    Updating…
                  </span>
                )}
                <button
                  type="button"
                  aria-label="Edit your name"
                  title="Edit your name"
                  className="inline-flex items-center justify-center rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                  onClick={() => {
                    setEditMemberErr("");
                    setEditingMember({
                      id: user.id,
                      name:
                        pendingNameOverrides[user.id] ??
                        accountDetails?.name ??
                        user.name,
                    });
                  }}
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              </p>
              <p><strong>Username:</strong> {accountDetails?.username ?? user.username}</p>
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
                <strong>Store Code:</strong>{" "}
                <span className="font-mono tracking-widest">
                  {storeDetails?.storeCode ?? user.storeCode ?? "—"}
                </span>
              </p>
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
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-200">
                  <p className="mb-2 font-semibold">Store name</p>
                  <p className="mb-3 opacity-90">
                    Update the name shown for this store in the app. Opening the dialog does not
                    change anything until you save.
                  </p>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-slate-500 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800/80"
                    onClick={() => {
                      setSettingsErr("");
                      setStoreNameDraft(storeDetails?.name ?? "");
                      setStoreRenameModalOpen(true);
                    }}
                  >
                    Change store name
                  </button>
                </div>
              ) : (
                <p className="text-xs opacity-70">
                  Only the store owner can rename this store.
                </p>
              )}

              {canDeleteStore && (
                <div className="mt-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                  <div className="mb-2 flex items-start gap-2">
                    <WarningTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="font-semibold">Security reset</p>
                  </div>
                  <p className="mb-2">
                    If someone obtained your store join code, rotate the code and remove selected staff in
                    one step. Trainers sign in with this code—after a reset, share the new code only with
                    trusted people. This cannot be undone.
                  </p>
                  <button
                    type="button"
                    className="rounded-lg border border-rose-400 bg-white px-4 py-2 text-sm font-medium text-rose-900 hover:bg-rose-100 dark:border-rose-400/50 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-950/70"
                    onClick={() => {
                      setResetStoreCodeErr("");
                      setResetStoreCodeConfirm("");
                      setResetStoreCodeKickScope("trainers_only");
                      setResetStoreCodeModalOpen(true);
                    }}
                  >
                    Edit store code
                  </button>

                  {resetStoreCodeModalOpen && (
                    <ResetStoreCodeConfirmModal
                      currentStoreCode={storeDetails?.storeCode ?? user.storeCode ?? ""}
                      confirmText={resetStoreCodeConfirm}
                      onConfirmTextChange={setResetStoreCodeConfirm}
                      kickScope={resetStoreCodeKickScope}
                      onKickScopeChange={setResetStoreCodeKickScope}
                      busy={resetStoreCodeBusy}
                      error={resetStoreCodeErr}
                      onClose={() => {
                        setResetStoreCodeModalOpen(false);
                        setResetStoreCodeConfirm("");
                        setResetStoreCodeErr("");
                      }}
                      onConfirmReset={async () => {
                        const expected = (storeDetails?.storeCode ?? user.storeCode ?? "").trim();
                        const typed = resetStoreCodeConfirm.trim();
                        if (expected.length !== 8 || typed !== expected) {
                          setResetStoreCodeErr("The code you entered does not match the current store code.");
                          return;
                        }
                        setResetStoreCodeErr("");
                        setResetStoreCodeBusy(true);
                        try {
                          const res = await api<{ store: { storeCode: string; name: string } }>(
                            "/api/settings/reset-store-code",
                            {
                              method: "POST",
                              body: JSON.stringify({
                                currentStoreCode: typed,
                                kickScope: resetStoreCodeKickScope,
                              }),
                            },
                          );
                          setResetStoreCodeModalOpen(false);
                          setResetStoreCodeConfirm("");
                          setUser((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  storeCode: res.store.storeCode,
                                  storeName: res.store.name,
                                }
                              : null,
                          );
                          await refreshCore();
                          await onSessionRefresh();
                        } catch (error) {
                          setResetStoreCodeErr((error as Error).message);
                        } finally {
                          setResetStoreCodeBusy(false);
                        }
                      }}
                    />
                  )}
                </div>
              )}

              {canDeleteStore && (
                <div className="mt-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                  <div className="mb-2 flex items-start gap-2">
                    <WarningTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="font-semibold">Danger zone</p>
                  </div>
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
                const themeChoice: "light" | "dark" | "system" = appearance.followSystemTheme
                  ? "system"
                  : appearance.darkMode
                    ? "dark"
                    : "light";
                const caption =
                  themeChoice === "light"
                    ? "Light mode"
                    : themeChoice === "dark"
                      ? "Dark mode"
                      : "Follow system setting";
                const themeDisabled = !appearanceReady;
                return (
                  <div
                    className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6 ${themeDisabled ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <span className="shrink-0 pt-1 text-base font-medium sm:pt-2.5">Theme</span>
                    <div className="flex w-full min-w-0 flex-col items-center gap-1.5 sm:w-auto sm:items-end">
                      <div
                        role="radiogroup"
                        aria-label="Theme"
                        className="grid h-[3.25rem] w-[13.5rem] max-w-full shrink-0 grid-cols-3 gap-1 rounded-full border-2 border-slate-300 bg-slate-100 p-1.5 dark:border-slate-600 dark:bg-slate-800/90"
                      >
                        <button
                          type="button"
                          role="radio"
                          aria-checked={themeChoice === "light"}
                          aria-label="Light mode"
                          disabled={themeDisabled}
                          onClick={() =>
                            setAppearance((prev) => ({
                              ...prev,
                              followSystemTheme: false,
                              darkMode: false,
                            }))
                          }
                          className={`flex items-center justify-center rounded-full transition-colors ${
                            themeChoice === "light"
                              ? "bg-white text-amber-600 shadow ring-1 ring-black/10 dark:bg-slate-700 dark:text-amber-300 dark:ring-white/10"
                              : "text-slate-500 hover:bg-white/60 dark:text-slate-400 dark:hover:bg-slate-700/50"
                          }`}
                        >
                          <SunIcon className="h-5 w-5 max-sm:h-[1.15rem] max-sm:w-[1.15rem]" />
                        </button>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={themeChoice === "system"}
                          aria-label="Follow system setting"
                          disabled={themeDisabled}
                          onClick={() =>
                            setAppearance((prev) => ({
                              ...prev,
                              followSystemTheme: true,
                              darkMode: systemPrefersDark,
                            }))
                          }
                          className={`flex items-center justify-center rounded-full transition-colors ${
                            themeChoice === "system"
                              ? "bg-white text-slate-800 shadow ring-1 ring-black/10 dark:bg-slate-600 dark:text-slate-100 dark:ring-white/15"
                              : "text-slate-500 hover:bg-white/60 dark:text-slate-400 dark:hover:bg-slate-700/50"
                          }`}
                        >
                          <SettingsGearIcon className="h-5 w-5 max-sm:h-[1.15rem] max-sm:w-[1.15rem]" />
                        </button>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={themeChoice === "dark"}
                          aria-label="Dark mode"
                          disabled={themeDisabled}
                          onClick={() =>
                            setAppearance((prev) => ({
                              ...prev,
                              followSystemTheme: false,
                              darkMode: true,
                            }))
                          }
                          className={`flex items-center justify-center rounded-full transition-colors ${
                            themeChoice === "dark"
                              ? "bg-white text-indigo-600 shadow ring-1 ring-black/10 dark:bg-slate-700 dark:text-indigo-300 dark:ring-white/10"
                              : "text-slate-500 hover:bg-white/60 dark:text-slate-400 dark:hover:bg-slate-700/50"
                          }`}
                        >
                          <MoonIcon className="h-5 w-5 max-sm:h-[1.15rem] max-sm:w-[1.15rem]" />
                        </button>
                      </div>
                      <p className="max-w-[13.5rem] text-center text-xs leading-snug opacity-80 sm:text-right">
                        {caption}
                      </p>
                    </div>
                  </div>
                );
              })()}
              <div
                className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6 ${!appearanceReady ? "pointer-events-none opacity-50" : ""}`}
              >
                <span className="shrink-0 pt-1 text-base font-medium sm:pt-2.5">Font size</span>
                <div className="flex w-full min-w-0 flex-col items-center gap-1.5 sm:w-auto sm:items-end">
                  <div
                    role="radiogroup"
                    aria-label="Font size"
                    className="grid h-[3.25rem] w-[13.5rem] max-w-full shrink-0 grid-cols-4 gap-1 rounded-full border-2 border-slate-300 bg-slate-100 p-1.5 dark:border-slate-600 dark:bg-slate-800/90"
                  >
                    {(
                      [
                        { scale: 0.9, label: "Small", kind: "smallA" as const },
                        { scale: 1, label: "Default", kind: "dot" as const },
                        { scale: 1.1, label: "Large", kind: "dot" as const },
                        { scale: 1.2, label: "Extra Large", kind: "bigA" as const },
                      ] as const
                    ).map((opt) => {
                      const active = appearance.fontScale === opt.scale;
                      const baseBtn =
                        "flex items-center justify-center rounded-full transition-colors touch-manipulation";
                      const activeBtn =
                        "bg-white text-slate-800 shadow ring-1 ring-black/10 dark:bg-slate-600 dark:text-slate-100 dark:ring-white/15";
                      const idleBtn =
                        "text-slate-500 hover:bg-white/60 dark:text-slate-400 dark:hover:bg-slate-700/50";
                      return (
                        <button
                          key={opt.scale}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={opt.label}
                          disabled={!appearanceReady}
                          onClick={() =>
                            setAppearance((prev) => ({ ...prev, fontScale: opt.scale }))
                          }
                          className={`${baseBtn} ${active ? activeBtn : idleBtn}`}
                        >
                          {opt.kind === "smallA" ? (
                            <span className="select-none text-sm font-semibold leading-none">A</span>
                          ) : opt.kind === "bigA" ? (
                            <span className="select-none text-xl font-bold leading-none tracking-tight">
                              A
                            </span>
                          ) : (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full bg-current opacity-90"
                              aria-hidden
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="max-w-[13.5rem] text-center text-xs leading-snug opacity-80 sm:text-right">
                    {appearance.fontScale === 0.9
                      ? "Small"
                      : appearance.fontScale === 1
                        ? "Default"
                        : appearance.fontScale === 1.1
                          ? "Large"
                          : "Extra Large"}
                  </p>
                </div>
              </div>
              <div
                className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6 ${!appearanceReady ? "pointer-events-none opacity-50" : ""}`}
              >
                <span className="shrink-0 pt-1 text-base font-medium sm:pt-2.5">Accent color</span>
                <div className="flex w-full min-w-0 flex-col items-center gap-1.5 sm:w-auto sm:items-end">
                  <div
                    role="radiogroup"
                    aria-label="Accent color"
                    className="grid h-[3.25rem] w-[13.5rem] max-w-full shrink-0 grid-cols-4 gap-1 rounded-full border-2 border-slate-300 bg-slate-100 p-1.5 dark:border-slate-600 dark:bg-slate-800/90"
                  >
                    {ACCENT_SWATCHES.map((sw) => {
                      const active = accentMatchesSwatch(appearance.accent, sw);
                      const baseBtn =
                        "flex items-center justify-center rounded-full transition-colors touch-manipulation";
                      const activeBtn =
                        "bg-white text-slate-800 shadow ring-1 ring-black/10 dark:bg-slate-600 dark:text-slate-100 dark:ring-white/15";
                      const idleBtn =
                        "text-slate-500 hover:bg-white/60 dark:text-slate-400 dark:hover:bg-slate-700/50";
                      return (
                        <button
                          key={sw.hex}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={sw.label}
                          disabled={!appearanceReady}
                          onClick={() =>
                            setAppearance((prev) => ({ ...prev, accent: sw.hex }))
                          }
                          className={`${baseBtn} ${active ? activeBtn : idleBtn}`}
                        >
                          <span
                            className="h-[1.35rem] w-[1.35rem] shrink-0 rounded-full shadow-inner ring-1 ring-black/25 dark:ring-white/25"
                            style={{ backgroundColor: sw.hex }}
                            aria-hidden
                          />
                        </button>
                      );
                    })}
                  </div>
                  {(() => {
                    const sw = accentSwatchFromValue(appearance.accent);
                    if (!sw) return null;
                    return (
                      <p className="max-w-[13.5rem] text-center text-xs leading-snug opacity-80 sm:text-right">
                        {sw.label === "Red" ? "Red (default)" : sw.label}
                      </p>
                    );
                  })()}
                </div>
              </div>
              {/* <label className={`flex items-center justify-between gap-2 ${!appearanceReady ? "pointer-events-none opacity-50" : ""}`}>
                <span>Compact cards</span>
                <input
                  type="checkbox"
                  checked={appearance.compactCards}
                  disabled={!appearanceReady}
                  onChange={() =>
                    setAppearance((prev) => ({ ...prev, compactCards: !prev.compactCards }))
                  }
                />
              </label> */}
              <p className="text-xs opacity-70">
                Saved for your account and synced across devices when you’re signed in.
              </p>
            </div>
          )}

          {category === "trainingSetup" && canManageTraining && (
            <TrainingSetupSection
              positions={positions}
              setPositions={setPositions}
              onRefresh={refreshCore}
            />
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
              {trainerInviteModalOpen && (
                <TrainerInviteModal
                  storeCode={accountDetails?.storeCode ?? storeDetails?.storeCode ?? user.storeCode ?? null}
                  onClose={() => setTrainerInviteModalOpen(false)}
                />
              )}
              <p className="mb-2 text-sm font-semibold">Team members</p>
              {teamActionError && !memberPendingDelete && (
                <p className="mb-2 text-sm text-rose-600">{teamActionError}</p>
              )}
              <div className="space-y-3 text-sm">
              {teamMembers.length === 0 && (
                <p className="opacity-70">
                  Loading team members… If this keeps saying empty, make sure the
                  server is running the latest Prisma client.
                </p>
              )}
              {teamMembers.map((rawMember) => {
                /**
                 * If a rename PATCH is in-flight, render the optimistic name from
                 * `pendingNameOverrides` instead of the (possibly stale) value from
                 * `teamMembers`. The parent re-polls every 5s and would otherwise
                 * clobber our optimistic update mid-flight.
                 */
                const optimisticName = pendingNameOverrides[rawMember.id];
                const member: TeamMember =
                  optimisticName !== undefined
                    ? { ...rawMember, name: optimisticName }
                    : rawMember;
                const isUpdating = optimisticName !== undefined;
                const isSelf = member.id === user.id;
                const isOwner = member.role === "OWNER";
                const isWebsiteDeveloper = member.role === "WEBSITE_DEVELOPER";
                const isAdmin = member.role === "ADMIN";
                const canSetOwnInitialPassword = isAdmin && isSelf && !member.hasPassword;
                const isSelfPasswordFormOpen = selfPasswordFormOpenForId === member.id;
                /**
                 * The role <select> + remove button are locked for:
                 *   - yourself (can't demote/remove self),
                 *   - the store owner (server rejects this anyway),
                 *   - the website developer (server-untouchable).
                 */
                const roleLocked = isSelf || isOwner || isWebsiteDeveloper;
                /**
                 * Name edit visibility:
                 * - You can always edit your own name.
                 * - Managers (members.updateRole permission) can edit anyone — except
                 *   only the owner can edit the owner's name.
                 */
                const canEditName =
                  isSelf ||
                  (allow("members.updateRole") &&
                    (member.role !== "OWNER" || effectiveRole === "OWNER"));
                return (
                <div
                  key={member.id}
                  className="rounded-lg bg-slate-100 p-3 text-left text-sm dark:bg-slate-700"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="flex items-center gap-2 font-semibold">
                        <span>{member.name}</span>
                        {isSelf && (
                          <span className="text-xs font-normal opacity-70">(you)</span>
                        )}
                        {canEditName && (
                          <button
                            type="button"
                            aria-label={
                              isSelf ? "Edit your name" : `Edit name for ${member.name}`
                            }
                            title={isSelf ? "Edit your name" : `Edit name for ${member.name}`}
                            className="inline-flex items-center justify-center rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                            onClick={() => {
                              setEditMemberErr("");
                              setEditingMember({ id: member.id, name: member.name });
                            }}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        )}
                        {isUpdating && (
                          <span
                            className="text-xs font-normal italic opacity-70"
                            aria-live="polite"
                          >
                            Updating…
                          </span>
                        )}
                      </p>
                      <p>@{member.username}</p>
                      <p className="opacity-70">
                        Joined {formatDateTime(member.createdAt)}
                      </p>
                      {isAdmin && (
                        <p className="opacity-70">
                          Password: {member.hasPassword ? "Set" : "Not set"}
                        </p>
                      )}
                      {canSetOwnInitialPassword && (
                        <div className="mt-2 space-y-2">
                          {!isSelfPasswordFormOpen ? (
                            <button
                              type="button"
                              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
                              onClick={() => {
                                setSelfPasswordFormOpenForId(member.id);
                                setSelfPasswordError("");
                                setSelfPasswordSuccess("");
                                setSelfPasswordDraft("");
                                setSelfPasswordConfirmDraft("");
                              }}
                            >
                              Set account password
                            </button>
                          ) : (
                            <form
                              className="space-y-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700"
                              onSubmit={async (e) => {
                                e.preventDefault();
                                setSelfPasswordError("");
                                setSelfPasswordSuccess("");
                                if (selfPasswordDraft.length < 8) {
                                  setSelfPasswordError("Password must be at least 8 characters.");
                                  return;
                                }
                                if (selfPasswordDraft !== selfPasswordConfirmDraft) {
                                  setSelfPasswordError("Passwords do not match.");
                                  return;
                                }
                                setSelfPasswordBusy(true);
                                try {
                                  await api("/api/settings/account/password", {
                                    method: "POST",
                                    body: JSON.stringify({ password: selfPasswordDraft }),
                                  });
                                  setSelfPasswordSuccess("Password set.");
                                  setSelfPasswordFormOpenForId(null);
                                  setSelfPasswordDraft("");
                                  setSelfPasswordConfirmDraft("");
                                  await refreshCore();
                                } catch (err) {
                                  setSelfPasswordError((err as Error).message);
                                } finally {
                                  setSelfPasswordBusy(false);
                                }
                              }}
                            >
                              <input
                                type="password"
                                value={selfPasswordDraft}
                                onChange={(e) => setSelfPasswordDraft(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-card px-2 py-1 text-xs text-foreground dark:border-slate-600"
                                placeholder="New password (min 8)"
                                autoComplete="new-password"
                                disabled={selfPasswordBusy}
                              />
                              <input
                                type="password"
                                value={selfPasswordConfirmDraft}
                                onChange={(e) => setSelfPasswordConfirmDraft(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-card px-2 py-1 text-xs text-foreground dark:border-slate-600"
                                placeholder="Confirm password"
                                autoComplete="new-password"
                                disabled={selfPasswordBusy}
                              />
                              <div className="flex gap-2">
                                <button
                                  type="submit"
                                  disabled={selfPasswordBusy}
                                  className="btn-accent rounded-lg px-3 py-1 text-xs font-medium disabled:opacity-60"
                                >
                                  {selfPasswordBusy ? "Saving..." : "Save password"}
                                </button>
                                <button
                                  type="button"
                                  disabled={selfPasswordBusy}
                                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
                                  onClick={() => {
                                    setSelfPasswordFormOpenForId(null);
                                    setSelfPasswordError("");
                                    setSelfPasswordSuccess("");
                                    setSelfPasswordDraft("");
                                    setSelfPasswordConfirmDraft("");
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          )}
                          {isSelf && selfPasswordError && (
                            <p className="text-xs text-rose-600">{selfPasswordError}</p>
                          )}
                          {isSelf && selfPasswordSuccess && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">
                              {selfPasswordSuccess}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      <label
                        className={`flex flex-col gap-1 text-xs font-medium ${roleLocked ? "opacity-50" : "opacity-80"}`}
                      >
                        Role
                        {isWebsiteDeveloper ? (
                          /*
                           * Website developer is a fixed, server-untouchable role.
                           * No <select> at all — render only the label so it can't
                           * be hovered/keyboard-clicked into a no-op interaction.
                           */
                          <span className="min-w-[10rem] rounded-lg border bg-card px-3 py-2 text-sm text-foreground">
                            {roleLabel("WEBSITE_DEVELOPER")}
                          </span>
                        ) : isOwner ? (
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
                              if (
                                next !== "ADMIN" &&
                                next !== "TRAINER" &&
                                !(next === "OWNER" && canAssignOwner)
                              ) {
                                return;
                              }
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
                            {canAssignOwner && <option value="OWNER">{roleLabel("OWNER")}</option>}
                            <option value="ADMIN">{roleLabel("ADMIN")}</option>
                            <option value="TRAINER">{roleLabel("TRAINER")}</option>
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
                        onClick={() => {
                          if (roleLocked) return;
                          setTeamActionError("");
                          setMemberPendingDelete(member);
                        }}
                      >
                        {member.role === "TRAINER"
                          ? "Remove Trainer"
                          : member.role === "OWNER"
                            ? "Remove owner"
                            : member.role === "WEBSITE_DEVELOPER"
                              ? "Remove developer"
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
                      {isWebsiteDeveloper && !isSelf && (
                        <p className="max-w-[14rem] text-right text-xs text-neutral-500 dark:text-neutral-400">
                          The website developer cannot be reassigned or removed.
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
                  const busyDelete = deletingTraineeId === row.id;
                  const busyEdit = savingTraineeId === row.id;
                  const busy = busyDelete || busyEdit;
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
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          aria-label={`Edit trainee ${row.name}`}
                          title={`Edit ${row.name}`}
                          disabled={busy}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                          onClick={() => {
                            if (busy) return;
                            setTraineeActionError("");
                            setTraineePendingEdit(row);
                          }}
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
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
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
      {memberPendingDelete !== null && (
        <DeleteTeamMemberConfirmModal
          memberName={memberPendingDelete.name}
          memberRole={memberPendingDelete.role}
          busy={deletingMemberId === memberPendingDelete.id}
          error={teamActionError}
          onClose={() => {
            if (deletingMemberId === memberPendingDelete.id) return;
            setMemberPendingDelete(null);
            setTeamActionError("");
          }}
          onConfirm={async () => {
            const target = memberPendingDelete;
            if (!target || deletingMemberId) return;
            setTeamActionError("");
            setDeletingMemberId(target.id);
            try {
              await api(`/api/settings/trainers/${target.id}`, {
                method: "DELETE",
              });
              setMemberPendingDelete(null);
              await refreshCore();
              if (target.id === user.id) {
                await onLogout();
              }
            } catch (err) {
              setTeamActionError((err as Error).message);
            } finally {
              setDeletingMemberId(null);
            }
          }}
        />
      )}
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
      {traineePendingEdit !== null && (
        <EditTraineeModal
          key={traineePendingEdit.id}
          trainee={traineePendingEdit}
          busy={savingTraineeId === traineePendingEdit.id}
          error={traineeActionError}
          onClose={() => {
            if (savingTraineeId === traineePendingEdit.id) return;
            setTraineePendingEdit(null);
            setTraineeActionError("");
          }}
          onSave={async (nextName) => {
            const row = traineePendingEdit;
            if (!row || savingTraineeId) return;
            setTraineeActionError("");
            setSavingTraineeId(row.id);
            try {
              await api(`/api/trainees/${row.id}`, {
                method: "PUT",
                body: JSON.stringify({ name: nextName }),
              });
              setTraineePendingEdit(null);
              await refreshCore();
            } catch (err) {
              setTraineeActionError((err as Error).message);
            } finally {
              setSavingTraineeId(null);
            }
          }}
        />
      )}
      {editingMember &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-member-name-title"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setEditingMember(null);
            }}
          >
            <form
              className="w-full max-w-md rounded-xl border bg-card p-5 shadow-lg"
              onMouseDown={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                if (!editingMember) return;
                const trimmed = editingMember.name.trim();
                if (trimmed.length < 1) {
                  setEditMemberErr("Name is required.");
                  return;
                }
                if (trimmed.length > 100) {
                  setEditMemberErr("Name must be 100 characters or fewer.");
                  return;
                }
                const memberId = editingMember.id;
                const memberRow = teamMembers.find((m) => m.id === memberId);
                const previousName =
                  memberRow?.name ??
                  (memberId === user.id ? (accountDetails?.name ?? user.name) : undefined);
                if (previousName === undefined) {
                  setEditMemberErr("Member not found.");
                  return;
                }
                if (trimmed === previousName) {
                  setEditingMember(null);
                  return;
                }
                setEditMemberErr("");
                setEditingMember(null);

                /*
                 * Optimistic update flow:
                 *   1. Modal closes immediately.
                 *   2. Stash the optimistic name in `pendingNameOverrides[memberId]`. The
                 *      render loop reads from this map first, so the new name is visible
                 *      INSTANTLY and survives the background 5s refetch poll that would
                 *      otherwise reset `teamMembers` to the (still-old) server value.
                 *   3. Also update `user` (header nav) for self-edits — `refreshCore`
                 *      doesn't touch `user.name`, so this is safe to set right away.
                 *   4. Fire the PATCH. On success, commit the new name into the parent's
                 *      `teamMembers` / `accountDetails` and THEN clear the override (so
                 *      no flicker between override-cleared and next-poll). On failure,
                 *      just clear the override → UI falls back to `teamMembers`'s value
                 *      (the original old name), and roll back `user` for self-edits.
                 */
                setPendingNameOverrides((prev) => ({ ...prev, [memberId]: trimmed }));
                if (memberId === user.id) {
                  setUser((prev) => (prev ? { ...prev, name: trimmed } : prev));
                }

                api(`/api/settings/trainers/${memberId}`, {
                  method: "PATCH",
                  body: JSON.stringify({ name: trimmed }),
                })
                  .then(() => {
                    setTeamMembers((prev) =>
                      prev.map((m) => (m.id === memberId ? { ...m, name: trimmed } : m)),
                    );
                    if (memberId === user.id) {
                      setAccountDetails((prevAcc) =>
                        prevAcc && prevAcc.id === memberId
                          ? { ...prevAcc, name: trimmed }
                          : prevAcc,
                      );
                    }
                    setPendingNameOverrides((prev) => {
                      if (!(memberId in prev)) return prev;
                      const next = { ...prev };
                      delete next[memberId];
                      return next;
                    });
                  })
                  .catch((err) => {
                    if (memberId === user.id) {
                      setUser((prevUser) =>
                        prevUser ? { ...prevUser, name: previousName } : prevUser,
                      );
                    }
                    setTeamActionError(`Rename failed: ${(err as Error).message}`);
                    setPendingNameOverrides((prev) => {
                      if (!(memberId in prev)) return prev;
                      const next = { ...prev };
                      delete next[memberId];
                      return next;
                    });
                  });
              }}
            >
              <h3 id="edit-member-name-title" className="mb-3 text-lg font-semibold">
                Edit name
              </h3>
              <p className="mb-3 text-xs opacity-70">
                Username @
                {teamMembers.find((m) => m.id === editingMember.id)?.username ??
                  accountDetails?.username ??
                  user.username ??
                  ""}{" "}
                stays the same — only the display name changes.
              </p>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                autoFocus
                value={editingMember.name}
                onChange={(e) =>
                  setEditingMember((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                }
                placeholder="Display name"
                className="mb-3 w-full rounded-lg border bg-background p-3"
              />
              {editMemberErr && <p className="mb-3 text-sm text-rose-600">{editMemberErr}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditingMember(null);
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
      {storeRenameModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="store-rename-title"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setSettingsErr("");
                setStoreRenameModalOpen(false);
              }
            }}
          >
            <form
              className="w-full max-w-md rounded-xl border bg-card p-5 shadow-lg"
              onMouseDown={(e) => e.stopPropagation()}
              onSubmit={async (e) => {
                e.preventDefault();
                setSettingsErr("");
                try {
                  await api("/api/settings/store-details", {
                    method: "PUT",
                    body: JSON.stringify({ name: storeNameDraft }),
                  });
                  setStoreRenameModalOpen(false);
                  await refreshCore();
                } catch (error) {
                  setSettingsErr((error as Error).message);
                }
              }}
            >
              <h3 id="store-rename-title" className="mb-3 text-lg font-semibold">
                Change store name
              </h3>
              <p className="mb-3 text-xs opacity-70">
                This is the name shown for your store in the app. Trainers and trainees see it
                where store context appears.
              </p>
              <label className="mb-1 block text-sm font-medium">Store name</label>
              <input
                autoFocus
                value={storeNameDraft}
                onChange={(e) => setStoreNameDraft(e.target.value)}
                className="mb-3 w-full rounded-lg border bg-background p-3"
                placeholder="Store name"
                required
              />
              {settingsErr && <p className="mb-3 text-sm text-rose-600">{settingsErr}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSettingsErr("");
                    setStoreRenameModalOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-accent rounded-lg px-4 py-2 text-sm font-medium">
                  Save
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </section>
  );
}
