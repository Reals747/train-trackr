import {
  FOURTH_SCHEDULES_ENV_ENABLED,
  FOURTH_SCHEDULES_ENV_KEYS,
  HOTSCHEDULES_ENV_ENABLED,
} from "@/lib/hotschedules/constants";
import type { FourthSchedulesConfigResult, FourthSchedulesCredentials } from "@/lib/hotschedules/types";

const ENV_API_ROOT = FOURTH_SCHEDULES_ENV_KEYS[0];
const ENV_USERNAME = FOURTH_SCHEDULES_ENV_KEYS[1];
const ENV_PASSWORD = FOURTH_SCHEDULES_ENV_KEYS[2];

/** Env var names required when Fourth Schedules integration is enabled. */
export { FOURTH_SCHEDULES_ENV_KEYS, FOURTH_SCHEDULES_ENV_KEYS as HOTSCHEDULES_ENV_KEYS };

function isEnabledFlag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true" || value?.trim() === "1";
}

function readEnv(primary: string, legacy?: string): string {
  const primaryValue = process.env[primary]?.trim();
  if (primaryValue) return primaryValue;
  if (legacy) return process.env[legacy]?.trim() ?? "";
  return "";
}

function readCredentials(): { credentials: FourthSchedulesCredentials | null; missing: string[] } {
  const missing: string[] = [];
  const apiRootUrl = readEnv(ENV_API_ROOT);
  const username = readEnv(ENV_USERNAME, "HOTSCHEDULES_USERNAME");
  const password = readEnv(ENV_PASSWORD, "HOTSCHEDULES_PASSWORD");

  if (!apiRootUrl) missing.push(ENV_API_ROOT);
  if (!username) missing.push(ENV_USERNAME);
  if (!password) missing.push(ENV_PASSWORD);

  if (missing.length > 0) {
    return { credentials: null, missing };
  }

  return {
    credentials: { apiRootUrl, username, password },
    missing: [],
  };
}

/**
 * Resolve whether Fourth Schedules API should be used.
 * - `FOURTH_SCHEDULES_ENABLED` (or legacy `HOTSCHEDULES_ENABLED`) not true → mock data
 * - enabled but missing env → misconfigured (UI shows errors)
 * - enabled with full env → ready for REST calls
 */
export function resolveFourthSchedulesConfig(): FourthSchedulesConfigResult {
  const enabled =
    isEnabledFlag(process.env[FOURTH_SCHEDULES_ENV_ENABLED]) ||
    isEnabledFlag(process.env[HOTSCHEDULES_ENV_ENABLED]);

  if (!enabled) {
    return { mode: "disabled" };
  }

  const { credentials, missing } = readCredentials();
  if (!credentials) {
    return { mode: "misconfigured", missing };
  }

  return { mode: "ready", credentials };
}

/** @deprecated Use resolveFourthSchedulesConfig */
export const resolveHotschedulesConfig = resolveFourthSchedulesConfig;

export function fourthSchedulesConfigErrorMessage(missing: string[]): string {
  if (missing.length === 0) {
    return "Fourth Schedules API is enabled but not fully configured.";
  }
  return `Fourth Schedules API is enabled but missing configuration: ${missing.join(", ")}.`;
}

/** @deprecated Use fourthSchedulesConfigErrorMessage */
export const hotschedulesConfigErrorMessage = fourthSchedulesConfigErrorMessage;
