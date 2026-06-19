"use client";

import { useSyncExternalStore } from "react";
import { getBusinessWeekday, toBusinessDateKey } from "@/lib/business-day";

/** JS `Date.getDay()` is 0=Sunday..6=Saturday; task columns are 0=Monday..5=Saturday. */
export function weekdayToTaskColumnIndex(jsDay: number): number {
  return jsDay - 1;
}

const PENDING_TASK_COLUMN = -2;
const BUSINESS_DAY_TICK_MS = 60_000;

function subscribeBusinessDay(onStoreChange: () => void): () => void {
  const id = window.setInterval(onStoreChange, BUSINESS_DAY_TICK_MS);
  return () => window.clearInterval(id);
}

/**
 * Current business-day task grid column index (Mon..Sat).
 * Before 3:00a local, still uses the previous calendar day's column.
 */
export function useClientTaskColumnIndex(): number {
  return useSyncExternalStore(
    subscribeBusinessDay,
    () => weekdayToTaskColumnIndex(getBusinessWeekday()),
    () => PENDING_TASK_COLUMN,
  );
}

export function isPendingClientTaskColumn(index: number): boolean {
  return index === PENDING_TASK_COLUMN;
}

/** Current business day `YYYY-MM-DD` (rolls at 3:00a local). */
export function useClientDateKey(): string {
  return useSyncExternalStore(subscribeBusinessDay, () => toBusinessDateKey(), () => "");
}

/** Current local time, refreshed on an interval for live schedule reminders. */
const CLIENT_NOW_UPDATE_MS = 60_000;
const serverNowSnapshot = new Date(0);
let cachedClientNow: Date | null = null;

function getClientNowSnapshot(): Date {
  if (!cachedClientNow) {
    cachedClientNow = new Date();
  }
  return cachedClientNow;
}

function subscribeClientNow(onStoreChange: () => void): () => void {
  cachedClientNow = new Date();

  const id = window.setInterval(() => {
    cachedClientNow = new Date();
    onStoreChange();
  }, CLIENT_NOW_UPDATE_MS);

  return () => window.clearInterval(id);
}

export function useClientNow(): Date {
  return useSyncExternalStore(subscribeClientNow, getClientNowSnapshot, () => serverNowSnapshot);
}
