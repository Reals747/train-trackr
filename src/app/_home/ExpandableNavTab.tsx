"use client";

const EXPAND_MS = "duration-[280ms]";
const EXPAND_EASE = "ease-[cubic-bezier(0.4,0,0.2,1)]";

type Props = {
  label: string;
  active: boolean;
  onClick: () => void;
};

export function ExpandableNavTab({ label, active, onClick }: Props) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-w-0 shrink basis-0 whitespace-nowrap rounded-lg px-2 py-3 text-xs font-medium transition-[flex-grow,background-color,color] sm:px-3 sm:text-sm ${EXPAND_MS} ${EXPAND_EASE} flex-grow aria-pressed:flex-grow-[1.12] ${
        active
          ? "btn-accent"
          : "bg-slate-100 text-slate-900 hover:bg-slate-200/90 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
      }`}
    >
      {label}
    </button>
  );
}
