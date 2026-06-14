import { APP_VERSION } from "@/lib/app-version";

export function SiteFooter() {
  return (
    <footer className="mt-auto shrink-0 border-t border-slate-200 px-4 py-3 text-center text-[0.6875rem] leading-relaxed text-slate-500 dark:border-slate-700 dark:text-slate-400">
      <p>Train Trackr website developed by Liam Powers.</p>
      <p className="mt-0.5 opacity-80">Version {APP_VERSION}</p>
    </footer>
  );
}
