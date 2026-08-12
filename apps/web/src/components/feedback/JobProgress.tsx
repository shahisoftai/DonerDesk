import { toneFor, type Tone } from "@/lib/shared/tone";

export type JobStage = "idle" | "queued" | "running" | "succeeded" | "failed" | "cancelled";

const stageLabel: Record<JobStage, string> = {
  idle: "Idle",
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
};

const stageTone: Record<JobStage, Tone> = {
  idle: "neutral",
  queued: "info",
  running: "info",
  succeeded: "success",
  failed: "danger",
  cancelled: "neutral",
};

export function JobProgress({
  stage,
  progress,
  stageDetail,
}: {
  stage: JobStage;
  progress?: number;
  stageDetail?: string;
}) {
  const t = toneFor(stageTone[stage]);
  const pct = typeof progress === "number" ? Math.min(100, Math.max(0, progress)) : null;
  return (
    <div className="w-full" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">{stageLabel[stage]}</span>
        {stageDetail && <span className="text-slate-500 dark:text-slate-400">{stageDetail}</span>}
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
        {stage === "running" && pct === null && <div className="h-full w-1/2 animate-pulse rounded-full bg-brand-500" />}
        {pct !== null && (
          <div
            className={`h-full rounded-full transition-all ${t === "danger" ? "bg-danger-500" : t === "success" ? "bg-success-500" : "bg-brand-500"}`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}
