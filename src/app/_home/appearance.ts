import type { AppearanceSettings } from "./types";

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  darkMode: false,
  fontScale: 1,
  accent: "#e51636",
  compactCards: false,
  followSystemTheme: true,
};

/** Preset accent colors (left → right). Legacy default `#dc2626` maps to Red. */
export const ACCENT_SWATCHES = [
  { label: "Blue", hex: "#2563eb" },
  { label: "Red", hex: "#e51636" },
  { label: "Purple", hex: "#7c3aed" },
  { label: "Green", hex: "#16a34a" },
] as const;

export function accentMatchesSwatch(accent: string, swatch: (typeof ACCENT_SWATCHES)[number]) {
  const a = accent.trim().toLowerCase();
  if (swatch.hex === "#e51636" && (a === "#e51636" || a === "#dc2626")) return true;
  return a === swatch.hex.toLowerCase();
}

export function accentSwatchFromValue(accent: string) {
  return ACCENT_SWATCHES.find((s) => accentMatchesSwatch(accent, s));
}
