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
