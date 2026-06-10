"use client";

import type { ActiveProfile } from "./types";

const OPTIONS: { value: ActiveProfile; label: string }[] = [
  { value: "FOH", label: "FOH" },
  { value: "BOH", label: "BOH" },
];

type Props = {
  value: ActiveProfile;
  onChange: (value: ActiveProfile) => void;
  disabled?: boolean;
};

export function ProfileToggle({ value, onChange, disabled }: Props) {
  return (
    <div
      className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-600 dark:bg-slate-800"
      role="group"
      aria-label="Active profile filter"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === opt.value}
          title={opt.label}
          className={`min-h-11 rounded-md px-2.5 py-2 text-xs font-semibold sm:px-3 sm:text-sm ${
            value === opt.value
              ? "btn-accent shadow-sm"
              : "text-slate-700 hover:bg-slate-200/80 dark:text-slate-200 dark:hover:bg-slate-700"
          } disabled:opacity-50`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
