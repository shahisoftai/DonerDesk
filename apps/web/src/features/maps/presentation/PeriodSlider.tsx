"use client";

import { useEffect, useState } from "react";
import { nextPlayStep, stepIndex, type PeriodStep } from "../domain/period-steps";

/** A slider over reporting periods with play/pause. It only reports the chosen period; the parent reads the data. */
export function PeriodSlider({ steps, periodId, onChange }: { steps: readonly PeriodStep[]; periodId: string | null; onChange: (periodId: string | null) => void }) {
  const [playing, setPlaying] = useState(false);
  const index = stepIndex(steps, periodId);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => onChange(steps[nextPlayStep(steps, stepIndex(steps, periodId))]?.periodId ?? null), 1800);
    return () => clearInterval(timer);
  }, [playing, steps, periodId, onChange]);
  if (steps.length <= 1) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button type="button" className="rounded border px-2" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</button>
      <input type="range" min={0} max={steps.length - 1} step={1} value={index} aria-label="Reporting period" className="min-w-40 flex-1" onChange={(e) => onChange(steps[Number(e.target.value)]?.periodId ?? null)} />
      <output aria-live="polite" className="font-medium">{steps[index]?.label}</output>
    </div>
  );
}
