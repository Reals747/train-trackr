/** Env var names for Fourth Schedules API (safe to import from client components). */

/** Primary enable flag for the Fourth Schedules REST API. */
export const FOURTH_SCHEDULES_ENV_ENABLED = "FOURTH_SCHEDULES_ENABLED";

/** @deprecated Use FOURTH_SCHEDULES_ENV_ENABLED. Kept for backward compatibility. */
export const HOTSCHEDULES_ENV_ENABLED = "HOTSCHEDULES_ENABLED";

export const FOURTH_SCHEDULES_ENV_KEYS = [
  "FOURTH_SCHEDULES_API_ROOT_URL",
  "FOURTH_SCHEDULES_USERNAME",
  "FOURTH_SCHEDULES_PASSWORD",
] as const;

/** @deprecated Legacy SOAP env keys — no longer used. */
export const HOTSCHEDULES_ENV_KEYS = FOURTH_SCHEDULES_ENV_KEYS;

export const FOURTH_SCHEDULES_API_GUIDE_URL =
  "https://developer.fourth.com/en-gb/docs/schedules-api/guide";
