"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APP_VERSION_BASE, APP_VERSION_BUILD } from "@/lib/app-version";

const BUILD_REVEAL_MS = 10_000;

export function SiteFooter() {
  const [showBuild, setShowBuild] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setShowBuild(false);
      hideTimerRef.current = null;
    }, BUILD_REVEAL_MS);
  }, [clearHideTimer]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  function handleFooterClick() {
    if (!APP_VERSION_BUILD) return;

    setShowBuild((current) => {
      const next = !current;
      if (next) scheduleHide();
      else clearHideTimer();
      return next;
    });
  }

  const versionLabel = showBuild && APP_VERSION_BUILD
    ? `${APP_VERSION_BASE}${APP_VERSION_BUILD}`
    : APP_VERSION_BASE;

  return (
    <footer
      onClick={handleFooterClick}
      className="mt-auto shrink-0 border-t border-slate-200 px-4 py-3 text-center text-[0.6875rem] leading-relaxed text-slate-500 dark:border-slate-700 dark:text-slate-400"
    >
      <p>Train Trackr website developed by Liam Powers.</p>
      <p className="mt-0.5 opacity-80">Version {versionLabel}</p>
    </footer>
  );
}
