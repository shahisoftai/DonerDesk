import Link from "next/link";
import { Badge } from "@/components/data/Badge";
import { dateTile, dueLabel, urgencyTone, type PaceReading, type UpcomingReport, type WeekPoint } from "../domain/home-derive";
import type { HomeInsights } from "../application/home-insights";
import type { ProjectDeadline } from "../application/dashboard-read-model";
import { pipelineBoard } from "../domain/home-derive";

/** A bar with a tick for the share of time that has passed. A missing value is a dashed track, never an empty bar. */
export function PaceBar({ reading, tone }: { reading: PaceReading; tone: "results" | "budget" }) {
  const fill = tone === "results" ? "bg-brand-500" : "bg-warning-500";
  if (reading.value === null) return <span className="text-xs text-slate-400 dark:text-slate-500">Not measured</span>;
  return (
    <div className="min-w-[110px]" title={`${reading.value}% against ${reading.timeElapsed}% of time elapsed`}>
      <div className="relative h-2 rounded-full bg-slate-200 dark:bg-white/10" role="img" aria-label={`${reading.value} percent, time elapsed ${reading.timeElapsed} percent`}>
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${reading.value}%` }} />
        <div className="absolute -top-1 -bottom-1 w-0.5 rounded bg-slate-900 dark:bg-white" style={{ left: `${reading.timeElapsed}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-slate-500 dark:text-slate-400"><span>{reading.value}%</span><span>time {reading.timeElapsed}%</span></div>
    </div>
  );
}

export function PaceLegend() {
  return (
    <p className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
      <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-brand-500 align-[-1px]" />Results (% of target)</span>
      <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-warning-500 align-[-1px]" />Budget spent</span>
      <span><i className="mr-1.5 inline-block h-3 w-0.5 bg-slate-900 align-[-2px] dark:bg-white" />Time elapsed</span>
    </p>
  );
}

export function DeadlineTiles({ items }: { items: ReadonlyArray<UpcomingReport> }) {
  if (items.length === 0) return <p className="text-sm text-slate-500 dark:text-slate-400">No reporting deadlines yet.</p>;
  return (
    <ul className="space-y-1">
      {items.map((u) => {
        const t = dateTile(u.deadline);
        return (
          <li key={u.periodId}>
            <Link href={`/projects/${u.projectId}/reports/${u.periodId}`} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-white/5">
              <span className="rounded-md bg-slate-100 py-1 text-center leading-tight dark:bg-white/10"><b className="block text-base tabular-nums">{t.day}</b><span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.month}</span></span>
              <span className="min-w-0"><span className="block break-words text-sm font-medium leading-5">{u.title}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{u.readinessScore}% ready</span></span>
              <Badge tone={urgencyTone(u.daysUntil)}>{dueLabel(u.daysUntil)}</Badge>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function PipelineBoard({ periods }: { periods: HomeInsights["periods"] }) {
  const stages = pipelineBoard(periods, 2);
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {stages.map((s) => (
        <div key={s.stage} className="min-w-0 rounded-lg bg-slate-100 p-3 dark:bg-white/5">
          <Link href="/reports" className="block"><span className="text-2xl font-semibold tabular-nums">{s.count}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{s.label}</span></Link>
          <ul className="mt-2 space-y-1.5">
            {s.items.map((p) => (
              <li key={p.periodId}><Link href={`/projects/${p.projectId}/reports/${p.periodId}`} className="block rounded-md border border-slate-200/70 bg-white px-2 py-1.5 text-xs transition hover:border-brand-400/40 dark:border-white/10 dark:bg-slate-900"><span className="block break-words font-medium">{p.projectTitle}</span><span className="text-slate-500 dark:text-slate-400">{dueLabel(p.daysUntil)}</span></Link></li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function RisksList({ risks }: { risks: HomeInsights["risks"] }) {
  if (risks.length === 0) return <p className="text-sm text-slate-500 dark:text-slate-400">No open problems or risks.</p>;
  const tone = { HIGH: "danger", MEDIUM: "warning", LOW: "success" } as const;
  const label = { HIGH: "Serious", MEDIUM: "Medium", LOW: "Low" } as const;
  return (
    <ul className="divide-y divide-slate-200/70 rounded-lg border border-slate-200/70 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.03]">
      {risks.slice(0, 5).map((r) => (
        <li key={r.id}>
          <Link href={`/projects/${r.projectId}`} className="flex items-center justify-between gap-3 px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-white/5">
            <span className="min-w-0"><span className="block break-words text-sm font-medium leading-5">{r.title}</span><span className="text-xs text-slate-500 dark:text-slate-400">{r.projectTitle}{r.reviewBy ? ` · review ${new Date(r.reviewBy).toLocaleDateString()}` : ""}</span></span>
            <Badge tone={tone[r.seriousness]} className="shrink-0">{label[r.seriousness]}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ResultsBars({ rows }: { rows: Array<{ projectId: string; title: string; reading: PaceReading }> }) {
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.projectId}>
          <Link href={`/projects/${r.projectId}/indicators`} className="grid grid-cols-[minmax(90px,150px)_minmax(0,1fr)_44px] items-center gap-3 rounded-md px-1 py-1.5 transition hover:bg-slate-100 dark:hover:bg-white/5">
            <span className="min-w-0 break-words text-sm leading-5">{r.title}</span>
            {r.reading.value === null ? <span className="text-xs text-slate-400">Not measured</span> : <span className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${r.reading.value}%` }} /></span>}
            <span className="text-right text-sm tabular-nums">{r.reading.value === null ? "—" : `${r.reading.value}%`}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function StatList({ rows }: { rows: Array<{ label: string; value: string; href: string; tone?: "danger" | "warning" }> }) {
  return (
    <ul className="divide-y divide-slate-200/70 rounded-lg border border-slate-200/70 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.03]">
      {rows.map((r) => (
        <li key={r.label}><Link href={r.href} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition hover:bg-slate-50 dark:hover:bg-white/5"><span>{r.label}</span><span className={`font-semibold tabular-nums ${r.tone === "danger" ? "text-danger-600 dark:text-danger-400" : r.tone === "warning" ? "text-warning-600 dark:text-warning-400" : ""}`}>{r.value}</span></Link></li>
      ))}
    </ul>
  );
}

export type { ProjectDeadline };

/** Share of planned work finished on time, per week, for the last weeks that are over. A week with nothing judged is a gap, not a zero. */
export function DeliverySparkline({ points }: { points: ReadonlyArray<WeekPoint> }) {
  const judged = points.filter((p) => p.percent !== null);
  if (judged.length === 0) return <p className="text-sm text-slate-500 dark:text-slate-400">No planned work has ended in the last 8 weeks yet.</p>;
  const w = 300, h = 80, pad = 6;
  const x = (i: number) => (points.length <= 1 ? w / 2 : (i / (points.length - 1)) * w);
  const y = (v: number) => h - pad - (v / 100) * (h - pad * 2);
  const runs: Array<Array<{ i: number; v: number }>> = [];
  let run: Array<{ i: number; v: number }> = [];
  points.forEach((p, i) => {
    if (p.percent === null) { if (run.length) runs.push(run); run = []; } else run.push({ i, v: p.percent });
  });
  if (run.length) runs.push(run);
  const last = [...points].reverse().find((p) => p.percent !== null)!;
  const lastIndex = points.indexOf(last);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Share of planned work finished on time, last 8 weeks. Latest week ${last.percent}%.`} className="block h-20 w-full overflow-visible">
        {[25, 50, 75].map((g) => <line key={g} x1="0" x2={w} y1={y(g)} y2={y(g)} className="stroke-slate-200 dark:stroke-white/10" strokeWidth="1" />)}
        {runs.map((r, k) => (
          <polyline key={k} fill="none" className="stroke-brand-500" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={r.map((p) => `${x(p.i)},${y(p.v)}`).join(" ")} />
        ))}
        <circle cx={x(lastIndex)} cy={y(last.percent!)} r="4" className="fill-brand-500 stroke-white dark:stroke-slate-900" strokeWidth="2" />
      </svg>
      <p className="mt-1 text-xs tabular-nums text-slate-500 dark:text-slate-400">Latest week {last.percent}% on time · {points.reduce((n, p) => n + p.judged, 0)} activities judged in 8 weeks</p>
    </div>
  );
}
