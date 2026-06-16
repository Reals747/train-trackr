"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProfileToggle } from "@/app/_home/ProfileToggle";
import { SwitchProfileConfirmModal } from "@/app/_home/settings-modals";
import { useProfileSwitch } from "@/app/_home/useProfileSwitch";
import type { ActiveProfile, StoreProfileRow } from "@/app/_home/types";
import { clientApi } from "@/lib/client-api";
import { MANAGER_ROLES, type RoleName } from "@/lib/permissions";
import { TasksManager } from "@/components/TasksManager";

export default function TasksFullPage() {
  const [role, setRole] = useState<RoleName | null>(null);
  const [activeProfile, setActiveProfile] = useState<ActiveProfile>("FOH");
  const [storeProfiles, setStoreProfiles] = useState<StoreProfileRow[]>([]);
  const [manageMode, setManageMode] = useState(false);

  const {
    profileSaving,
    pendingProfileKey,
    pendingProfileName,
    profileSwitchError,
    requestProfileSwitch,
    confirmPendingProfileSwitch,
    cancelPendingProfileSwitch,
  } = useProfileSwitch({
    role,
    activeProfile,
    setActiveProfile,
    storeProfiles,
    saveProfile: (body) =>
      clientApi("/api/settings/profile", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
  });

  useEffect(() => {
    let cancelled = false;
    clientApi<{ user: { role: RoleName; activeProfile?: ActiveProfile } }>("/api/auth/me")
      .then((data) => {
        if (!cancelled) {
          setRole(data.user.role);
          if (data.user.activeProfile) setActiveProfile(data.user.activeProfile);
        }
      })
      .catch(() => {
        if (!cancelled) setRole(null);
      });
    clientApi<{ profiles: StoreProfileRow[] }>("/api/store-profiles")
      .then((data) => {
        if (!cancelled) {
          setStoreProfiles(data.profiles);
          setActiveProfile((prev) =>
            data.profiles.some((profile) => profile.key === prev)
              ? prev
              : (data.profiles[0]?.key ?? "FOH"),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setStoreProfiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canManage = role !== null && MANAGER_ROLES.includes(role);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 p-3 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Tasks</h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ProfileToggle
            value={activeProfile}
            onChange={requestProfileSwitch}
            profiles={storeProfiles}
            disabled={profileSaving}
          />
          {canManage && (
            <button
              type="button"
              onClick={() => setManageMode((prev) => !prev)}
              aria-pressed={manageMode}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
                manageMode
                  ? "btn-accent"
                  : "bg-slate-100 text-slate-900 hover:bg-slate-200/90 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
              }`}
            >
              {manageMode ? "Done" : "Manage Tasks"}
            </button>
          )}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200/90 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
          >
            Back
          </Link>
        </div>
      </div>
      <section className="rounded-xl bg-card p-4 shadow-sm">
        <TasksManager manageMode={manageMode} activeProfile={activeProfile} />
      </section>

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
