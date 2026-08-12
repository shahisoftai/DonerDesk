import { toneFor, type Tone } from "@/lib/shared/tone";

export function ProgressBar({
  value,
  max = 100,
  tone = "info",
  label,
}: {
  value: number;
  max?: number;
  tone?: Tone;
  label?: string;
}) {
  const t = toneFor(tone);
  const pct = Math.min(100, Math.max(0, (value / Math.max(1, max)) * 100));
  const barColor =
    t === "success"
      ? "bg-success-500"
      : t === "warning"
        ? "bg-warning-500"
        : t === "danger"
          ? "bg-danger-500"
          : t === "ai"
            ? "bg-ai-500"
            : "bg-brand-500";

  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label} className="w-full">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
