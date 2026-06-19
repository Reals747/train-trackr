/** Injected at build time from package.json semver + git build metadata (see next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0+dev";

const buildSeparatorIndex = APP_VERSION.indexOf("+");

/** Semver base only, e.g. `2.2.8` from `2.2.8+48`. */
export const APP_VERSION_BASE =
  buildSeparatorIndex === -1 ? APP_VERSION : APP_VERSION.slice(0, buildSeparatorIndex);

/** Build metadata suffix, e.g. `+48` or `+abc1234`; null when absent. */
export const APP_VERSION_BUILD =
  buildSeparatorIndex === -1 ? null : APP_VERSION.slice(buildSeparatorIndex);
