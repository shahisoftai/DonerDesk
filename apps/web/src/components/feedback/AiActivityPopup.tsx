"use client";

import { useEffect, useRef, useState } from "react";
import { simulatedPercent } from "./ai-activity-progress";

const STEP_INTERVAL_MS = 2800;

export interface AiActivityPopupProps {
  open: boolean;
  /** e.g. "Analysing your template" / "Writing your report". */
  title: string;
  /** Short status lines cycled every ~2.8s while no real progress is known. */
  steps: readonly string[];
  /** 0-100. Omit to show a time-based estimate instead (see `estimatedMs`). */
  progressPercent?: number;
  /** Only used without `progressPercent`: how long this usually takes, to pace the simulated bar. */
  estimatedMs?: number;
  /** e.g. "12 of 40 sections". Shown next to the percentage when known. */
  progressLabel?: string;
  /** Small reassurance line under the bar, e.g. "This can take a few minutes — feel free to keep working.". */
  note?: string;
  /**
   * "overlay": centered, dims the page — for a screen with nothing else to
   * look at (template extraction).
   * "corner": bottom-right, non-blocking — for a screen with content to keep
   * reading underneath (report generation).
   */
  variant?: "overlay" | "corner";
}

/**
 * Animated "AI is working" indicator for operations with no useful
 * intermediate UI of their own (a multi-second-to-minutes server call): a
 * pulsing AI badge, a rotating line of what is currently happening, and a
 * progress bar — real when the caller knows one (e.g. sections done/total),
 * simulated otherwise — so a long wait reads as active work, not a stall.
 */
export function AiActivityPopup({ open, title, steps, progressPercent, estimatedMs = 100_000, progressLabel, note, variant = "overlay" }: AiActivityPopupProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      startedAtRef.current = null;
      setStepIndex(0);
      setElapsedMs(0);
      return;
    }
    startedAtRef.current ??= Date.now();
    const stepTimer = window.setInterval(() => setStepIndex((i) => (i + 1) % Math.max(1, steps.length)), STEP_INTERVAL_MS);
    const tickTimer = window.setInterval(() => setElapsedMs(Date.now() - (startedAtRef.current ?? Date.now())), 500);
    return () => {
      window.clearInterval(stepTimer);
      window.clearInterval(tickTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- steps.length only; a changing steps array shouldn't restart the cycle
  }, [open]);

  if (!open) return null;

  const percent = Math.max(0, Math.min(100, progressPercent ?? simulatedPercent(elapsedMs, estimatedMs)));
  const isReal = progressPercent !== undefined;
  const card = (
    <div
      role="status"
      aria-live="polite"
      className={`w-full rounded-2xl border border-ai-500/20 bg-white p-5 shadow-xl dark:border-ai-500/25 dark:bg-slate-900 ${variant === "overlay" ? "max-w-sm" : "max-w-xs"}`}
    >
      <div className="flex items-start gap-3">
        <AiOrb />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
          <p className="mt-1 min-h-[2.5rem] text-sm text-slate-600 dark:text-slate-300">{steps[stepIndex % Math.max(1, steps.length)]}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-ai-500 to-ai-600 bg-[length:200%_100%] transition-[width] duration-700 ease-out"
            style={{ width: `${percent}%`, animation: isReal ? undefined : "shimmer 2.4s linear infinite" }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{progressLabel ?? (isReal ? `${Math.round(percent)}%` : "Working…")}</span>
          {!isReal && <span>{Math.round(percent)}%</span>}
        </div>
      </div>

      {note && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{note}</p>}
    </div>
  );

  if (variant === "corner") {
    return <div className="fixed bottom-4 right-4 z-40 animate-fade-in">{card}</div>;
  }
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" aria-hidden="true" />
      <div className="relative animate-fade-in">{card}</div>
    </div>
  );
}

/** A small pulsing "AI is thinking" badge: two soft rings breathing around a solid core. */
function AiOrb() {
  return (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center" aria-hidden="true">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ai-500/40" />
      <span className="absolute inline-flex h-6 w-6 animate-pulse rounded-full bg-ai-500/30" />
      <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-ai-600 dark:bg-ai-500" />
    </span>
  );
}
