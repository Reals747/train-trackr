"use client";

import type { ReactNode } from "react";

const EXPAND_MS = "duration-[280ms]";
const EXPAND_EASE = "ease-[cubic-bezier(0.4,0,0.2,1)]";

type Props = {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  inactiveClassName?: string;
  activeClassName?: string;
};

export function ExpandableHeaderButton({
  label,
  active,
  onClick,
  icon,
  inactiveClassName = "border border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200/90 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600",
  activeClassName = "btn-accent",
}: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`group inline-flex h-12 items-center overflow-hidden rounded-lg text-sm font-medium transition-colors ${EXPAND_MS} ${EXPAND_EASE} ${
        active ? activeClassName : inactiveClassName
      }`}
    >
      <span
        className={`grid ${EXPAND_MS} ${EXPAND_EASE} transition-[grid-template-columns] [grid-template-columns:0fr] group-hover:[grid-template-columns:1fr] group-aria-pressed:[grid-template-columns:1fr]`}
      >
        <span className="min-w-0 overflow-hidden">
          <span
            className={`block whitespace-nowrap pl-3 pr-1 opacity-0 transition-opacity ${EXPAND_MS} ${EXPAND_EASE} group-hover:opacity-100 group-aria-pressed:opacity-100`}
          >
            {label}
          </span>
        </span>
      </span>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center">{icon}</span>
    </button>
  );
}
