"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

export function AddTraineeModalFlow({ onRefresh }: { onRefresh: () => Promise<void> }) {
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
