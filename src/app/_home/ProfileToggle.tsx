"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDisclosureIcon } from "./icons";
import type { StoreProfileRow } from "@/lib/store-profiles";
import { profileColorSelectClasses } from "@/lib/store-profiles";

const MENU_MS = "duration-[280ms]";
const MENU_EASE = "ease-[cubic-bezier(0.4,0,0.2,1)]";

type Props = {
  value: string;
  onChange: (value: string) => void;
  profiles: StoreProfileRow[];
  disabled?: boolean;
};

export function ProfileToggle({ value, onChange, profiles, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [listMounted, setListMounted] = useState(false);
  const [listVisible, setListVisible] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const active = profiles.find((profile) => profile.key === value);
  const isDisabled = disabled || profiles.length === 0;

  useEffect(() => {
    if (open) {
      setHighlight(Math.max(0, profiles.findIndex((profile) => profile.key === value)));
    }
  }, [open, profiles, value]);

  useEffect(() => {
    if (open && profiles.length > 0) {
      setListMounted(true);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setListVisible(true));
      });
      return () => cancelAnimationFrame(frame);
    }

    setListVisible(false);
    const timer = window.setTimeout(() => setListMounted(false), 280);
    return () => clearTimeout(timer);
  }, [open, profiles.length]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlight((index) => Math.min(index + 1, profiles.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlight((index) => Math.max(index - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        setHighlight((index) => {
          const profile = profiles[index];
          if (profile) onChange(profile.key);
          setOpen(false);
          return index;
        });
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onChange, profiles]);

  const triggerClasses = active
    ? profileColorSelectClasses(active.color)
    : "border-slate-200 bg-card text-foreground dark:border-slate-600";

  function selectProfile(key: string) {
    onChange(key);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        disabled={isDisabled}
        aria-label={active ? `Active profile: ${active.name}` : "Active profile filter"}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        title={active?.name}
        onClick={() => {
          if (!isDisabled) setOpen((current) => !current);
        }}
        className={`inline-flex min-h-9 min-w-0 max-w-full items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50 ${triggerClasses}`}
      >
        <span className="truncate">{active?.name ?? "Profile"}</span>
        <ChevronDisclosureIcon expanded={open} className="h-4 w-4 shrink-0 opacity-70" />
      </button>

      {listMounted && profiles.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Profiles"
          aria-hidden={!listVisible}
          className={`absolute right-0 z-50 mt-1.5 flex w-max min-w-full origin-top-right flex-col gap-1 rounded-2xl border border-slate-200 bg-card p-1.5 shadow-lg transition-[opacity,transform] ${MENU_MS} ${MENU_EASE} dark:border-slate-600 ${
            listVisible
              ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
              : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
          }`}
        >
          {profiles.map((profile, index) => {
            const selected = profile.key === value;
            const focused = index === highlight;
            return (
              <li key={profile.key} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => selectProfile(profile.key)}
                  className={`flex w-full items-center justify-between gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-left text-sm font-semibold transition-opacity hover:opacity-95 ${profileColorSelectClasses(profile.color)} ${
                    selected || focused ? "ring-2 ring-current/25 ring-offset-1 ring-offset-card" : ""
                  }`}
                >
                  <span>{profile.name}</span>
                  <span
                    className={`w-3 shrink-0 text-center text-xs font-bold ${selected ? "opacity-70" : "invisible"}`}
                    aria-hidden
                  >
                    ✓
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
