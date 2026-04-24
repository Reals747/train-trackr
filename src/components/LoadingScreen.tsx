/**
 * Universal loading screen.
 *
 * Used automatically by the Next.js App Router via `app/loading.tsx` (and any
 * nested `loading.tsx`) during route transitions / RSC streaming. Also safe to
 * render manually from client components while waiting on data.
 */
export default function LoadingScreen({
  label = "Loading checklist",
  fullscreen = true,
}: {
  label?: string;
  fullscreen?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background"
          : "flex w-full flex-col items-center justify-center gap-6 p-8"
      }
    >
      <svg
        className="h-24 w-24 animate-spin sm:h-28 sm:w-28"
        viewBox="0 0 50 50"
        aria-hidden
      >
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          strokeWidth="2"
          className="stroke-slate-200 dark:stroke-slate-700"
        />
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="40 126"
        />
      </svg>
      <p className="text-lg font-medium text-white">
        {label}
        <span className="inline-block animate-pulse" aria-hidden>…</span>
      </p>
      <span className="sr-only">{label}</span>
    </div>
  );
}
