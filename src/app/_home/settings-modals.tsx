"use client";

import { useEffect, useState } from "react";
import { roleLabel, type RoleName } from "@/lib/permissions";
import { WarningTriangleIcon } from "./icons";
import type { DashboardRow, DataProfile, StoreCodeKickScope } from "./types";

export function TrainerInviteModal({
  storeCode,
  onClose,
}: {
  storeCode: string | null;
  onClose: () => void;
}) {
  const [status, setStatus] = useState("");

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
          Share this permanent store code with anyone you want to give access. Trainers use it
          together with a username to sign in — no password required.
        </p>

        <p className="mt-4 font-mono text-3xl tracking-[0.35em]">{storeCode ?? "—"}</p>

        {storeCode && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-accent rounded-lg px-4 py-2"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(storeCode);
                  setStatus("Code copied to clipboard.");
                } catch {
                  setStatus("Couldn't copy automatically. Select the code to copy.");
                }
              }}
            >
              Copy code
            </button>
          </div>
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

export function DeleteStoreConfirmModal({
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
        <div className="mb-2 flex items-start gap-2">
          <WarningTriangleIcon className="mt-0.5 h-7 w-7 shrink-0 text-amber-500" />
          <h3 id="delete-store-dialog-title" className="text-lg font-semibold text-rose-900 dark:text-rose-200">
            Delete this store?
          </h3>
        </div>
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

export function DeleteStoreProfileConfirmModal({
  profileName,
  confirmText,
  onConfirmTextChange,
  busy,
  error,
  onClose,
  onConfirmDeletion,
}: {
  profileName: string;
  confirmText: string;
  onConfirmTextChange: (v: string) => void;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirmDeletion: () => void | Promise<void>;
}) {
  const nameMatches =
    profileName.trim().length > 0 && confirmText.trim() === profileName.trim();

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
      aria-labelledby="delete-profile-dialog-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border bg-card p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-start gap-2">
          <WarningTriangleIcon className="mt-0.5 h-7 w-7 shrink-0 text-amber-500" />
          <h3 id="delete-profile-dialog-title" className="text-lg font-semibold text-rose-900 dark:text-rose-200">
            Delete this profile?
          </h3>
        </div>
        <p className="mb-4 text-sm text-foreground">
          This removes the profile from your store settings. It can only be deleted when no
          positions, trainees, tasks, or users are still using it.
        </p>
        <p className="mb-3 text-sm">To confirm, type the profile name exactly as shown:</p>
        <p className="mb-4 rounded-lg border bg-slate-100 px-3 py-2 font-medium dark:bg-slate-800">
          {profileName || "(unknown)"}
        </p>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide opacity-70">
          Profile name
        </label>
        <input
          autoFocus
          value={confirmText}
          onChange={(e) => onConfirmTextChange(e.target.value)}
          placeholder="Type the full profile name"
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

export function ResetStoreCodeConfirmModal({
  currentStoreCode,
  confirmText,
  onConfirmTextChange,
  kickScope,
  onKickScopeChange,
  busy,
  error,
  onClose,
  onConfirmReset,
}: {
  currentStoreCode: string;
  confirmText: string;
  onConfirmTextChange: (v: string) => void;
  kickScope: StoreCodeKickScope;
  onKickScopeChange: (v: StoreCodeKickScope) => void;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirmReset: () => void | Promise<void>;
}) {
  const digitsOnly = confirmText.replace(/\D/g, "").slice(0, 8);
  const codeMatches =
    currentStoreCode.length === 8 && digitsOnly === currentStoreCode;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const kickSummary =
    kickScope === "trainers_only"
      ? "All trainers will be permanently removed from this store. Admins keep their accounts. The store owner always keeps access."
      : "All trainers and admins will be permanently removed. Only the store owner will remain. Removed users lose access immediately.";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-store-code-title"
      onMouseDown={(e) => {
        if (busy) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border bg-card p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start gap-2">
          <WarningTriangleIcon className="mt-0.5 h-7 w-7 text-amber-500" />
          <h3 id="reset-store-code-title" className="text-lg font-semibold text-rose-900 dark:text-rose-200">
            Reset store code?
          </h3>
        </div>
        <p className="mb-3 text-sm text-foreground">
          Use this only after a security incident where someone may have obtained your store join code. A new
          code will be generated. Share the new code only with people who should still have access.
        </p>
        <p className="mb-3 text-sm font-medium text-foreground">{kickSummary}</p>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide opacity-70">
          Who to remove from this store
        </label>
        <select
          value={kickScope}
          onChange={(e) => onKickScopeChange(e.target.value as StoreCodeKickScope)}
          disabled={busy}
          className="mb-4 w-full rounded-lg border border-slate-200 bg-card p-3 text-foreground dark:border-slate-600"
        >
          <option value="trainers_only">Kick only trainers</option>
          <option value="trainers_and_admins">Kick trainers and admins</option>
        </select>
        <p className="mb-2 text-sm">
          To confirm, type the <strong className="font-semibold">current</strong> store code exactly:
        </p>
        <p className="mb-3 rounded-lg border bg-slate-100 px-3 py-2 font-mono text-lg tracking-[0.25em] dark:bg-slate-800">
          {currentStoreCode || "(unknown)"}
        </p>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide opacity-70">
          Current store code
        </label>
        <input
          autoFocus
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          value={confirmText}
          onChange={(e) => onConfirmTextChange(e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="8-digit code"
          className="mb-3 w-full rounded-lg border bg-background p-3 font-mono tracking-widest"
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
            disabled={!codeMatches || busy}
            onClick={() => void onConfirmReset()}
          >
            {busy ? "Resetting…" : "Confirm reset"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function teamMemberRemoveActionLabel(role: RoleName): string {
  switch (role) {
    case "TRAINER":
      return "Remove trainer";
    case "OWNER":
      return "Remove owner";
    case "WEBSITE_DEVELOPER":
      return "Remove developer";
    default:
      return "Remove admin";
  }
}

export function DeleteTeamMemberConfirmModal({
  memberName,
  memberRole,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  memberName: string;
  memberRole: RoleName;
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

  const confirmLabel = teamMemberRemoveActionLabel(memberRole);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-team-member-dialog-title"
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
          id="delete-team-member-dialog-title"
          className="mb-2 text-lg font-semibold text-rose-900 dark:text-rose-200"
        >
          Remove this team member?
        </h3>
        <p className="mb-4 text-sm text-foreground">
          <strong className="font-semibold">{memberName}</strong> ({roleLabel(memberRole)}) will be
          removed from your store and will lose access immediately. This cannot be undone.
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
            {busy ? "Removing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeleteTraineeConfirmModal({
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

export function EditTraineeModal({
  trainee,
  busy,
  error,
  onClose,
  onSave,
}: {
  trainee: DashboardRow;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (payload: { name: string; profile?: DataProfile }) => void | Promise<void>;
}) {
  const [name, setName] = useState(trainee.name);

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
      aria-labelledby="edit-trainee-dialog-title"
      onMouseDown={(e) => {
        if (busy) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border bg-card p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="edit-trainee-dialog-title" className="mb-3 text-lg font-semibold">
          Edit trainee name
        </h3>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (trimmed.length < 2) return;
            void onSave({ name: trimmed });
          }}
        >
          <label htmlFor="edit-trainee-name" className="sr-only">
            Name
          </label>
          <input
            id="edit-trainee-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full rounded-lg border bg-background p-3"
            required
            minLength={2}
            autoComplete="name"
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              className="rounded-lg border px-4 py-2 text-sm font-medium"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-accent rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy || name.trim().length < 2 || name.trim() === trainee.name}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
