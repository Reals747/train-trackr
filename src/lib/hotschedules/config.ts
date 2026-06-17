import {
  HOTSCHEDULES_ENV_ENABLED,
  HOTSCHEDULES_ENV_KEYS,
} from "@/lib/hotschedules/constants";
import type { HotschedulesConfigResult, HotschedulesCredentials } from "@/lib/hotschedules/types";

const ENV_USERNAME = HOTSCHEDULES_ENV_KEYS[0];
const ENV_PASSWORD = HOTSCHEDULES_ENV_KEYS[1];
const ENV_CONCEPT = HOTSCHEDULES_ENV_KEYS[2];
const ENV_STORE_NUM = HOTSCHEDULES_ENV_KEYS[3];

/** Env var names required when HotSchedules integration is enabled. */
export { HOTSCHEDULES_ENV_KEYS };

function isEnabledFlag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true" || value?.trim() === "1";
}

function readCredentials(): { credentials: HotschedulesCredentials | null; missing: string[] } {
  const missing: string[] = [];
  const username = process.env[ENV_USERNAME]?.trim() ?? "";
  const password = process.env[ENV_PASSWORD]?.trim() ?? "";
  const conceptRaw = process.env[ENV_CONCEPT]?.trim() ?? "";
  const storeNumRaw = process.env[ENV_STORE_NUM]?.trim() ?? "";

  if (!username) missing.push(ENV_USERNAME);
  if (!password) missing.push(ENV_PASSWORD);
  if (!conceptRaw) missing.push(ENV_CONCEPT);
  if (!storeNumRaw) missing.push(ENV_STORE_NUM);

  const concept = Number(conceptRaw);
  const storeNum = Number(storeNumRaw);
  if (conceptRaw && !Number.isInteger(concept)) missing.push(`${ENV_CONCEPT} (must be an integer)`);
  if (storeNumRaw && !Number.isInteger(storeNum)) missing.push(`${ENV_STORE_NUM} (must be an integer)`);

  if (missing.length > 0) {
    return { credentials: null, missing };
  }

  return {
    credentials: { username, password, concept, storeNum },
    missing: [],
  };
}

/**
 * Resolve whether HotSchedules should be used for this deployment.
 * - `HOTSCHEDULES_ENABLED` not true → mock schedule data
 * - enabled but missing/invalid env → misconfigured (UI shows errors)
 * - enabled with full env → ready for SOAP calls
 */
export function resolveHotschedulesConfig(): HotschedulesConfigResult {
  if (!isEnabledFlag(process.env[HOTSCHEDULES_ENV_ENABLED])) {
    return { mode: "disabled" };
  }

  const { credentials, missing } = readCredentials();
  if (!credentials) {
    return { mode: "misconfigured", missing };
  }

  return { mode: "ready", credentials };
}

/** User-facing labels for missing configuration fields. */
export function hotschedulesConfigErrorMessage(missing: string[]): string {
  if (missing.length === 0) {
    return "HotSchedules is enabled but not fully configured.";
  }
  return `HotSchedules is enabled but missing configuration: ${missing.join(", ")}.`;
}
