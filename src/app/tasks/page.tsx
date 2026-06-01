"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clientApi } from "@/lib/client-api";
import { MANAGER_ROLES, type RoleName } from "@/lib/permissions";
import { TasksManager } from "@/components/TasksManager";

export default function TasksFullPage() {
  const [role, setRole] = useState<RoleName | null>(null);
  const [manageMode, setManageMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    clientApi<{ user: { role: RoleName } }>("/api/auth/me")
      .then((data) => {
        if (!cancelled) setRole(data.user.role);
      })
      .catch(() => {
        if (!cancelled) setRole(null);
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
        <div className="flex items-center gap-2">
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
        <TasksManager manageMode={manageMode} />
      </section>
    </main>
  );
}
