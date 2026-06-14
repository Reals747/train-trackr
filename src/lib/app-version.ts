/** Injected at build time from package.json semver + git build metadata (see next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0+dev";
