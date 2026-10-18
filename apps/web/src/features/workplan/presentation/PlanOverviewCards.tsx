import Link from "next/link";
import { countOf } from "@donordesk/domain/core/plural.js";
import { Badge } from "@/components/data/Badge";
import type { DeliveryHealthResponse } from "@/lib/server/schemas";
import type { OutputProgress, PlanCounts } from "../domain/delivery-overview";

const BAND_TONE = { ON_TRACK: "success", AT_RISK: "warning", OFF_TRACK: "danger", NO_PLAN: "neutral" } as const;

/**
 * Two cards on the project Overview, shown only when a plan exists: how the plan stands (plain counts) and, per output, the
 * activities done of planned beside the output's indicators. Server-rendered; no new tab, nowhere new to go.
 */
export function PlanOverviewCards({ projectId, counts, outputs, health }: { projectId: string; counts: PlanCounts; outputs: OutputProgress[]; health?: DeliveryHealthResponse | undefined }) {
  return (
    <section className="mt-6 grid gap-4 lg:grid-cols-2" aria-label="Planned activities">
      <div className="card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">Delivery</h2>
          {health && health.band !== "NO_PLAN" && <Badge tone={BAND_TONE[health.band]}>{health.label}</Badge>}
        </div>
        {health && health.reasons.length > 0 && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{health.reasons.join(" · ")}</p>}
        <p className="mt-1 text-2xl font-semibold tracking-tight">
          {counts.done} <span className="text-base font-normal text-slate-500">of {countOf(counts.planned, "planned activity", "planned activities")} done</span>
        </p>
        <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <li>{counts.late === 0 ? "None late" : <span className="font-medium text-red-600">{countOf(counts.late, "activity", "activities")} late</span>}</li>
          <li>{countOf(counts.underWay, "activity", "activities")} under way</li>
          <li>{countOf(counts.dueSoon, "activity", "activities")} starting within a week</li>
        </ul>
        <Link className="mt-3 inline-block text-sm text-brand-700 hover:underline dark:text-brand-300" href={`/projects/${projectId}/activities?view=planned`}>See the plan</Link>
      </div>

      <div className="card">
        <h2 className="font-medium">Outputs</h2>
        <ul className="mt-2 divide-y divide-slate-200 dark:divide-white/10">
          {outputs.map((o) => (
            <li key={o.outputId ?? "other"} className="py-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{o.title}</span>
                <span className="text-slate-600 dark:text-slate-300">{o.done} of {o.planned} done{o.late > 0 ? <span className="text-red-600"> · {o.late} late</span> : null}</span>
              </div>
              {o.indicators.map((i) => <p key={i.code} className="text-xs text-slate-500">{i.code} {i.name}: {i.percent} of target</p>)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
