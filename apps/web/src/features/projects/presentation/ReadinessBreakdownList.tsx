import Link from "next/link";
import { ProgressBar } from "@/components/data/ProgressBar";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import type { Tone } from "@/lib/shared/tone";
import type { ReadinessBreakdown } from "@/features/projects/application/project-overview-read-model";
import { blockerActionHref } from "@/features/projects/application/readiness-view";

type Dimension = "sections" | "indicators" | "evidence" | "checklist" | "approval";

const DIMENSIONS: ReadonlyArray<{
  key: Dimension;
  label: string;
  score: (r: ReadinessBreakdown) => number;
  href: (projectId: string, periodId: string) => string;
  action: string;
}> = [
  { key: "sections", label: "Sections approved", score: (r) => r.sectionsScore, href: (p, rp) => `/projects/${p}/reports/${rp}`, action: "Review sections" },
  { key: "indicators", label: "Indicators verified", score: (r) => r.indicatorsScore, href: (p, rp) => `/projects/${p}/reports/${rp}/inputs`, action: "Enter & verify values" },
  { key: "evidence", label: "Evidence attached", score: (r) => r.evidenceScore, href: (p) => `/projects/${p}/evidence`, action: "Attach evidence" },
  { key: "checklist", label: "Checklist resolved", score: (r) => r.checklistScore, href: (p) => `/projects/${p}/compliance`, action: "Resolve checklist" },
  { key: "approval", label: "Approval", score: (r) => r.approvalScore, href: (p, rp) => `/projects/${p}/reports/${rp}`, action: "Open approval" },
];

function tone(value: number): Tone {
  return value >= 75 ? "success" : value >= 40 ? "warning" : "danger";
}

/** Readiness broken down by weighted dimension, with what each one contributes and where to improve it. */
export function ReadinessBreakdownList({
  readiness,
  projectId,
  periodId,
}: {
  readiness: ReadinessBreakdown;
  projectId: string;
  periodId: string;
}) {
  const blockers = readiness.dataQualityBlockers ?? 0;
  const top = readiness.topBlockers ?? [];
  const changes = readiness.recentChanges ?? [];
  return (
    <>
      {changes.length > 0 && (
        <section className="mt-6" aria-label="What changed">
          <h3 className="text-sm font-medium">What changed in the last day</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
            {changes.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </section>
      )}
      {top.length > 0 && (
        <section className="mt-6" aria-label="Top things to do">
          <h3 className="text-sm font-medium">Top {top.length === 1 ? "thing" : `${top.length} things`} to do</h3>
          <ol className="mt-2 space-y-2">
            {top.map((b) => (
              <li key={b.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 p-3 text-sm dark:border-white/10">
                <div className="min-w-0">
                  <p className="font-medium">{b.label} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">+{b.points} pts</span></p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{b.detail}</p>
                </div>
                <Link className="btn-secondary shrink-0 text-sm" href={blockerActionHref(b.action.kind, projectId, periodId)}>{b.action.label}</Link>
              </li>
            ))}
          </ol>
        </section>
      )}
      <dl className="mt-6 space-y-4">
        {DIMENSIONS.map((dimension) => {
          const value = dimension.score(readiness);
          const weight = readiness.weights?.[dimension.key];
          return (
            <div key={dimension.key}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <dt>
                  {dimension.label}
                  {weight !== undefined && (
                    <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                      weight {Math.round(weight * 100)}% · adds {Math.round(value * weight)} pts
                    </span>
                  )}
                </dt>
                <dd className="flex items-center gap-3">
                  <span className="font-medium tabular-nums">{value}%</span>
                  {value < 100 && (
                    <Link className="text-xs text-brand-600 hover:underline dark:text-brand-400" href={dimension.href(projectId, periodId)}>
                      {dimension.action} →
                    </Link>
                  )}
                </dd>
              </div>
              <div className="mt-1"><ProgressBar value={value} tone={tone(value)} /></div>
            </div>
          );
        })}
      </dl>
      {blockers > 0 && (
        <InlineAlert tone="danger" title="Capped by data quality" className="mt-4">
          {blockers} unresolved contradiction{blockers === 1 ? "" : "s"} in the report
          {readiness.dataQualityPenalty ? ` (−${readiness.dataQualityPenalty} pts each)` : ""}.{" "}
          <Link className="font-medium underline" href={`/projects/${projectId}/reports/${periodId}`}>Resolve them</Link>
        </InlineAlert>
      )}
    </>
  );
}
