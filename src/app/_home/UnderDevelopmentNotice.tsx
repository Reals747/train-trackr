import { WarningTriangleIcon } from "./icons";

/** Inline amber warning icon + label for section headers. */
export function UnderDevelopmentLabel() {
  return (
    <>
      <WarningTriangleIcon className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Under development</span>
    </>
  );
}

/** Centered amber "under development" callout, reused by the Tasks and Schedule tabs. */
export function UnderDevelopmentNotice() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-amber-300/90 bg-amber-100 px-4 py-6 text-center text-amber-900 dark:border-amber-500/50 dark:bg-amber-900/40 dark:text-amber-100">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-8 w-8 shrink-0"
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.515 2.625H3.72c-1.345 0-2.188-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
      <p className="text-sm font-medium">
        This feature is under development and not ready yet
      </p>
    </div>
  );
}
