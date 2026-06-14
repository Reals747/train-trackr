/** Client-safe store profile types and styling helpers (no Prisma). */

export const PROFILE_COLOR_OPTIONS = ["sky", "amber", "green", "blue", "purple"] as const;
export type ProfileColor = (typeof PROFILE_COLOR_OPTIONS)[number];

export type StoreProfileRow = {
  id: string;
  key: string;
  name: string;
  color: ProfileColor;
  sortOrder: number;
};

export const FALLBACK_STORE_PROFILES: StoreProfileRow[] = [
  { id: "fallback-foh", key: "FOH", name: "FOH", color: "sky", sortOrder: 0 },
  { id: "fallback-boh", key: "BOH", name: "BOH", color: "amber", sortOrder: 1 },
];

export function isProfileColor(value: string): value is ProfileColor {
  return (PROFILE_COLOR_OPTIONS as readonly string[]).includes(value);
}

export function profileColorSelectClasses(color: ProfileColor): string {
  switch (color) {
    case "sky":
      return "border-sky-200/90 bg-sky-50/70 text-sky-950 dark:border-sky-700/50 dark:bg-sky-950/30 dark:text-sky-100";
    case "amber":
      return "border-amber-200/90 bg-amber-50/70 text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100";
    case "green":
      return "border-green-200/90 bg-green-50/70 text-green-950 dark:border-green-700/50 dark:bg-green-950/30 dark:text-green-100";
    case "blue":
      return "border-blue-200/90 bg-blue-50/70 text-blue-950 dark:border-blue-700/50 dark:bg-blue-950/30 dark:text-blue-100";
    case "purple":
      return "border-purple-200/90 bg-purple-50/70 text-purple-950 dark:border-purple-700/50 dark:bg-purple-950/30 dark:text-purple-100";
    default:
      return "border-slate-200 bg-card text-foreground dark:border-slate-600";
  }
}

export function profileColorSwatchClasses(color: ProfileColor, selected: boolean): string {
  const base =
    color === "sky"
      ? "bg-sky-400 dark:bg-sky-500"
      : color === "amber"
        ? "bg-amber-400 dark:bg-amber-500"
        : color === "green"
          ? "bg-green-500 dark:bg-green-600"
          : color === "blue"
            ? "bg-blue-500 dark:bg-blue-600"
            : "bg-purple-500 dark:bg-purple-600";
  return `${base} ${selected ? "ring-2 ring-offset-2 ring-slate-900/30 dark:ring-white/40" : "opacity-80 hover:opacity-100"}`;
}

export function profileKeyFromName(name: string): string {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return slug || `PROFILE_${Date.now()}`;
}

export function normalizeActiveProfileKey(
  value: string | null | undefined,
  profiles: StoreProfileRow[],
): string {
  if (value && profiles.some((profile) => profile.key === value)) return value;
  return profiles[0]?.key ?? "FOH";
}

export function serializeStoreProfile(row: {
  id: string;
  key: string;
  name: string;
  color: string;
  sortOrder: number;
}): StoreProfileRow {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    color: isProfileColor(row.color) ? row.color : "sky",
    sortOrder: row.sortOrder,
  };
}
