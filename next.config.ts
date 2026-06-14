import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Semver base from package.json, plus build metadata that changes on each deploy/commit.
 * Example: 0.1.0+847 (847 = git commit count, or short SHA on Vercel).
 */
function getAppVersion(): string {
  const base = JSON.parse(readFileSync("package.json", "utf8")).version as string;

  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return `${base}+${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}`;
  }

  try {
    const build = execSync("git rev-list --count HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return build ? `${base}+${build}` : base;
  } catch {
    return `${base}+dev`;
  }
}

/**
 * When you open the dev server from another device using http://<PC-LAN-IP>:3000, Next.js
 * treats that as a different origin than localhost and blocks `/_next/*` dev resources unless
 * the host is listed here — you get a shell page but React/buttons won't run on the phone.
 * Set DEV_LAN_ORIGINS in .env (comma-separated IPv4s from `ipconfig`).
 */
const devLanOrigins =
  process.env.NODE_ENV === "development" && process.env.DEV_LAN_ORIGINS
    ? process.env.DEV_LAN_ORIGINS.split(/[,]+/).map((s) => s.trim()).filter(Boolean)
    : [];

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: getAppVersion(),
  },
  ...(devLanOrigins.length > 0 ? { allowedDevOrigins: devLanOrigins } : {}),
};

export default nextConfig;
