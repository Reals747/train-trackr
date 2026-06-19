"use client";

import { useSyncExternalStore } from "react";
import { toDateKey } from "@/lib/schedule";

const noopSubscribe = () => () => {};

/** JS `Date.getDay()` is 0=Sunday..6=Saturday; task columns are 0=Monday..5=Saturday. */
export function weekdayToTaskColumnIndex(jsDay: number): number {
  return jsDay - 1;
}

const PENDING_TASK_COLUMN = -2;

/**
 * Today's task grid column index without waiting for a post-mount effect.
 * Server snapshot is a sentinel; the client resolves on first paint.
 */
export function useClientTaskColumnIndex(): number {
  return useSyncExternalStore(
    noopSubscribe,
    () => weekdayToTaskColumnIndex(new Date().getDay()),
    () => PENDING_TASK_COLUMN,
  );
}

export function isPendingClientTaskColumn(index: number): boolean {
  return index === PENDING_TASK_COLUMN;
}

/** Local calendar date `YYYY-MM-DD` without waiting for a post-mount effect. */
export function useClientDateKey(): string {
  return useSyncExternalStore(noopSubscribe, () => toDateKey(new Date()), () => "");
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
