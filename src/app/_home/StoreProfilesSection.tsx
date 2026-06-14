"use client";

import { useEffect, useState } from "react";
import { PencilIcon } from "./icons";
import { api } from "./api";
import { DeleteStoreProfileConfirmModal } from "./settings-modals";
import type { StoreProfileRow } from "@/lib/store-profiles";
import {
  PROFILE_COLOR_OPTIONS,
  profileColorSelectClasses,
  profileColorSwatchClasses,
  type ProfileColor,
} from "@/lib/store-profiles";

export function StoreProfilesSection({
  profiles,
  onProfilesChange,
}: {
  profiles: StoreProfileRow[];
  onProfilesChange: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<ProfileColor>("green");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<StoreProfileRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    if (!editingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditingId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingId]);

  async function saveProfileName(profile: StoreProfileRow) {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === profile.name) {
      setEditingId(null);
      return;
    }
    setBusyId(profile.id);
    setError("");
    try {
      await api(`/api/settings/store-profiles/${profile.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
      setEditingId(null);
      await onProfilesChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function saveProfileColor(profile: StoreProfileRow, color: ProfileColor) {
    if (color === profile.color) return;
    setBusyId(profile.id);
    setError("");
    try {
      await api(`/api/settings/store-profiles/${profile.id}`, {
        method: "PATCH",
        body: JSON.stringify({ color }),
      });
      await onProfilesChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function addProfile() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setAdding(true);
    setError("");
    try {
      await api("/api/settings/store-profiles", {
        method: "POST",
        body: JSON.stringify({ name: trimmed, color: newColor }),
      });
      setNewName("");
      setNewColor("green");
      await onProfilesChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-200">
        <p className="mb-2 font-semibold">Manage profiles</p>
        <p className="mb-3 opacity-90">
          Add, rename, recolor, or remove store profiles such as Front of House (FOH) and Back of
          House (BOH). Each profile filters positions, trainees, and tasks separately across the
          app.
        </p>

        <div className="space-y-2">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className={`rounded-lg border px-3 py-2 ${profileColorSelectClasses(profile.color)}`}
            >
              <div className="flex items-center justify-between gap-2">
                {editingId === profile.id ? (
                  <form
                    className="flex min-w-0 flex-1 items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveProfileName(profile);
                    }}
                  >
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-card px-2 py-1 text-sm text-foreground dark:border-slate-600"
                      maxLength={40}
                      disabled={busyId === profile.id}
                    />
                    <button
                      type="submit"
                      disabled={busyId === profile.id}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium dark:border-slate-500 dark:bg-slate-900"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      disabled={busyId === profile.id}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium dark:border-slate-500"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{profile.name}</span>
                      <button
                        type="button"
                        aria-label={`Edit name for ${profile.name}`}
                        title={`Edit name for ${profile.name}`}
                        disabled={busyId === profile.id}
                        className="inline-flex items-center justify-center rounded p-1 text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-700/60"
                        onClick={() => {
                          setEditingId(profile.id);
                          setEditName(profile.name);
                          setError("");
                        }}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === profile.id || profiles.length <= 1}
                      className="shrink-0 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => {
                        setError("");
                        setDeleteConfirm("");
                        setPendingDelete(profile);
                      }}
                    >
                      Delete profile
                    </button>
                  </>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium opacity-80">Color</span>
                {PROFILE_COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Set ${profile.name} color to ${color}`}
                    title={color}
                    disabled={busyId === profile.id}
                    className={`h-6 w-6 rounded-full ${profileColorSwatchClasses(color, profile.color === color)}`}
                    onClick={() => void saveProfileColor(profile, color)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg border border-slate-200 bg-white/70 p-3 dark:border-slate-600 dark:bg-slate-900/40">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-70">
            Add profile
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-xs font-medium opacity-80">Name</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-card px-3 py-2 text-sm text-foreground dark:border-slate-600"
                placeholder="Profile name"
                maxLength={40}
                disabled={adding}
              />
            </label>
            <div>
              <span className="mb-1 block text-xs font-medium opacity-80">Color</span>
              <div className="flex items-center gap-2">
                {PROFILE_COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`New profile color ${color}`}
                    className={`h-6 w-6 rounded-full ${profileColorSwatchClasses(color, newColor === color)}`}
                    onClick={() => setNewColor(color)}
                  />
                ))}
              </div>
            </div>
            <button
              type="button"
              disabled={adding || !newName.trim()}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-500 dark:bg-slate-900 dark:text-slate-100"
              onClick={() => void addProfile()}
            >
              {adding ? "Adding..." : "Add profile"}
            </button>
          </div>
        </div>

        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </div>

      {pendingDelete && (
        <DeleteStoreProfileConfirmModal
          profileName={pendingDelete.name}
          confirmText={deleteConfirm}
          onConfirmTextChange={setDeleteConfirm}
          busy={busyId === pendingDelete.id}
          error={error}
          onClose={() => {
            if (busyId === pendingDelete.id) return;
            setPendingDelete(null);
            setDeleteConfirm("");
            setError("");
          }}
          onConfirmDeletion={async () => {
            const target = pendingDelete;
            if (!target || busyId) return;
            if (deleteConfirm.trim() !== target.name.trim()) {
              setError("The name you entered does not match this profile.");
              return;
            }
            setBusyId(target.id);
            setError("");
            try {
              await api(`/api/settings/store-profiles/${target.id}`, { method: "DELETE" });
              setPendingDelete(null);
              setDeleteConfirm("");
              await onProfilesChange();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusyId(null);
            }
          }}
        />
      )}
    </>
  );
}
