"use client";

import {
  useRef,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

/** Variable-length digit entry (used for store join codes); digits stored left-to-right. */
export function DigitCodeInput({
  slots,
  onSlotsChange,
  label,
  helper,
  idPrefix,
}: {
  slots: string[];
  onSlotsChange: (next: string[]) => void;
  label: string;
  helper: string;
  idPrefix: string;
}) {
  const length = slots.length;
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const setSlots = onSlotsChange;

  function focusSlot(i: number) {
    inputRefs.current[i]?.focus();
    inputRefs.current[i]?.select();
  }

  function handleDigit(i: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...slots];
    if (digit) {
      next[i] = digit;
      setSlots(next);
      if (i < length - 1) focusSlot(i + 1);
    } else {
      next[i] = "";
      setSlots(next);
    }
  }

  function handleKeyDown(i: number, e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !slots[i] && i > 0) {
      e.preventDefault();
      const next = [...slots];
      next[i - 1] = "";
      setSlots(next);
      focusSlot(i - 1);
    }
  }

  function handlePaste(i: number, e: ReactClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (text.length === length) {
      e.preventDefault();
      setSlots(text.split(""));
      focusSlot(length - 1);
    } else if (text.length > 0 && i === 0) {
      e.preventDefault();
      const next = [...slots];
      for (let j = 0; j < length; j++) next[j] = text[j] ?? "";
      setSlots(next);
      const last = Math.min(text.length - 1, length - 1);
      focusSlot(last);
    }
  }

  return (
    <div className="mb-6 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-500 dark:bg-slate-900/40">
      <p className="mb-3 text-center text-sm font-semibold tracking-wide text-foreground">
        {label}
      </p>
      <div className="flex justify-center gap-1.5 sm:gap-2">
        {slots.map((ch, i) => (
          <div
            key={i}
            className="relative flex-1 max-w-[3.25rem] rounded-lg border-2 border-slate-300 bg-card shadow-inner dark:border-slate-500 dark:bg-card"
          >
            <label htmlFor={`${idPrefix}-${i}`} className="sr-only">
              Digit {i + 1} of {length}
            </label>
            <input
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              id={`${idPrefix}-${i}`}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={1}
              value={ch}
              aria-label={`${label} digit ${i + 1} of ${length}`}
              className="min-h-[3.5rem] h-14 w-full rounded-[inherit] border-0 bg-transparent text-center text-3xl font-semibold tabular-nums leading-none text-foreground outline-none ring-0 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent,#e51636)] focus-visible:outline-offset-[-2px] sm:min-h-[4rem] sm:h-16 sm:text-4xl"
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={(e) => handlePaste(i, e)}
              onFocus={(e) => e.target.select()}
            />
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs opacity-70">{helper}</p>
    </div>
  );
}
