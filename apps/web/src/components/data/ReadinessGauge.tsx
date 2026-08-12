import { ProgressBar } from "./ProgressBar";
import { toneFor, type Tone } from "@/lib/shared/tone";

function readinessTone(value: number): Tone {
  if (value >= 75) return "success";
  if (value >= 40) return "warning";
  return "danger";
}

export function ReadinessGauge({ value, label }: { value: number; label?: string }) {
  const tone = readinessTone(value);
  const t = toneFor(tone);
  const textColor =
    t === "success"
      ? "text-success-600 dark:text-success-400"
      : t === "warning"
        ? "text-warning-600 dark:text-warning-400"
        : "text-danger-600 dark:text-danger-400";
  return (
    <div className="text-center">
      <div className={`text-4xl font-extrabold ${textColor}`}>{value}%</div>
      {label && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</div>}
      <div className="mt-3">
        <ProgressBar value={value} tone={tone} />
      </div>
    </div>
  );
}
