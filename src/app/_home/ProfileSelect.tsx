"use client";

import type { DataProfile } from "./types";

type Props = {
  id: string;
  value: DataProfile;
  onChange: (value: DataProfile) => void;
  label?: string;
};

/** Required FOH/BOH picker when the user view is "Both Profiles". */
export function ProfileSelect({ id, value, onChange, label = "Profile" }: Props) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        name="profile"
        value={value}
        onChange={(e) => onChange(e.target.value as DataProfile)}
        className="w-full rounded-lg border border-slate-200 bg-background p-3 text-foreground dark:border-slate-600"
        required
      >
        <option value="FOH">Front of House (FOH)</option>
        <option value="BOH">Back of House (BOH)</option>
      </select>
    </div>
  );
}
