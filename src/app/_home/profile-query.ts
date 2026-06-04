import type { ActiveProfile } from "./types";

/** Append `?profile=` for API reads scoped to the user's active view filter. */
export function withProfileQuery(path: string, activeProfile: ActiveProfile): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}profile=${encodeURIComponent(activeProfile)}`;
}
