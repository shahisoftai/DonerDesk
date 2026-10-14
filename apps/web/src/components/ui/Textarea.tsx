"use client";

import { forwardRef, useCallback, useRef, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";
import { insertAtCaret, useDictation } from "./useDictation";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
  /** Offer a microphone button that types what the user says (browsers with speech recognition only). */
  dictate?: boolean;
};

const BASE =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-brand-400/70";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, dictate, className, ...props },
  ref,
) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  const setRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      inner.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  const { supported, state, toggle } = useDictation(
    (text) => inner.current && insertAtCaret(inner.current, text),
    () => {
      const el = inner.current;
      if (el && document.activeElement !== el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    },
  );

  const field = (
    <textarea
      ref={setRef}
      className={cn(BASE, invalid && "border-danger-500 focus:border-danger-500 focus:ring-danger-500/30", dictate && supported && "pr-11", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
  if (!dictate || !supported) return field;

  const listening = state === "listening";
  const label = listening ? "Stop dictating" : "Dictate with your voice";
  return (
    <div className="relative">
      {field}
      <button
        type="button"
        onClick={toggle}
        disabled={props.disabled || props.readOnly}
        aria-label={label}
        aria-pressed={listening}
        title={label}
        className={cn(
          "absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg border text-slate-600 transition disabled:opacity-50 dark:text-slate-300",
          listening
            ? "animate-pulse border-danger-500 bg-danger-500/10 text-danger-600"
            : "border-slate-300 bg-white hover:border-brand-400 hover:text-brand-600 dark:border-white/15 dark:bg-white/5",
        )}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="3" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </button>
      <p role="status" aria-live="polite" className="mt-1 text-xs text-slate-500 dark:text-slate-400 empty:hidden">
        {listening && "Listening… speak, then press the microphone to stop."}
        {state === "denied" && "Microphone access was blocked. Allow it in your browser settings to dictate."}
        {state === "error" && "Dictation stopped unexpectedly. Try again."}
      </p>
    </div>
  );
});
