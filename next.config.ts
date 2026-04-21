import type { NextConfig } from "next";

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
  ...(devLanOrigins.length > 0 ? { allowedDevOrigins: devLanOrigins } : {}),
};

export default nextConfig;
