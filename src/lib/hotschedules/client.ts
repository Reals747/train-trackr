import type { FourthSchedulesCredentials, FourthShift } from "@/lib/hotschedules/types";
import { parseDateKey } from "@/lib/schedule";

function normalizeApiRootUrl(rootUrl: string): string {
  return rootUrl.replace(/\/$/, "");
}

/** `YYYY-MM-DD` → `YYYYMMDD` for Fourth `fromDate` / `toDate` query params. */
export function toFourthDateParam(dateKey: string): string {
  const parsed = parseDateKey(dateKey);
  if (!parsed) throw new Error(`Invalid date key: ${dateKey}`);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function basicAuthHeader(credentials: FourthSchedulesCredentials): string {
  const token = Buffer.from(`${credentials.username}:${credentials.password}`, "utf8").toString("base64");
  return `Basic ${token}`;
}

function parseErrorMessage(body: string, status: number): string {
  try {
    const json = JSON.parse(body) as { message?: string; error?: string; errorMessage?: string };
    return json.message ?? json.errorMessage ?? json.error ?? `Fourth Schedules API HTTP ${status}`;
  } catch {
    return `Fourth Schedules API HTTP ${status}: ${body.slice(0, 300)}`;
  }
}

function isFourthShift(value: unknown): value is FourthShift {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.fourthAccountId === "string" &&
    typeof row.startDateTime === "string" &&
    typeof row.endDateTime === "string"
  );
}

/**
 * Fetch published shifts for a calendar day.
 * Fourth assigns each shift to the day it ends (`workDate`); we query that day inclusively.
 * @see https://developer.fourth.com/en-gb/docs/schedules-api/guide
 */
export async function fetchFourthSchedulesShiftsForDay(
  credentials: FourthSchedulesCredentials,
  dateKey: string,
): Promise<FourthShift[]> {
  const fourthDate = toFourthDateParam(dateKey);
  const url = `${normalizeApiRootUrl(credentials.apiRootUrl)}/shifts?fromDate=${fourthDate}&toDate=${fourthDate}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: basicAuthHeader(credentials),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(parseErrorMessage(body, response.status));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("Fourth Schedules API returned invalid JSON.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Fourth Schedules API returned an unexpected response shape.");
  }

  const isoDateKey = dateKey.trim();
  return parsed
    .filter(isFourthShift)
    .filter((shift) => shift.workDate === isoDateKey);
}
