import Link from "next/link";
import { countOf } from "@donordesk/domain/core/plural.js";
import { Badge } from "@/components/data/Badge";
import { formatDate } from "@/lib/shared/dates";
import type { DeliveryData } from "@/features/projects/application/overview-view";
import { Bar, CardHead, OverviewSection, PersonMark } from "./overview-pieces";

/**
 * The plan against reality: how much is done, what was moved and why it moved, the week's work
 * whoever owns it, and each output's progress beside its indicators.
 */
export function DeliverySection({ delivery, projectId }: { delivery: DeliveryData; projectId: string }) {
  const { counts, health, movements, week, outputs, people } = delivery;
  const nameOf = (userId: string | undefined) => people.find((p) => p.id === userId)?.label.replace(/ \(you\)$/, "");
  return (
    <OverviewSection kicker="Delivery" title="Plan against reality" href={`/projects/${projectId}/activities?view=planned`} linkLabel="See the plan">
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <CardHead
            title="Plan summary"
            action={health ? <Badge tone={healthTone(health.band)}>{health.label}</Badge> : undefined}
          />
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
            {counts.done} <span className="text-sm font-normal text-slate-500">of {countOf(counts.planned, "planned activity", "planned activities")} done</span>
          </p>
          <div className="mt-2">
            <Bar value={counts.planned > 0 ? Math.round((counts.done / counts.planned) * 100) : 0} tone={health ? healthTone(health.band) : "info"} />
          </div>
          {health && health.reasons.length > 0 ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{health.reasons.join(" · ")}</p> : null}
          <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex justify-between"><span>Under way</span><span className="tabular-nums">{counts.underWay}</span></li>
            <li className="flex justify-between"><span>Starting within a week</span><span className="tabular-nums">{counts.dueSoon}</span></li>
            <li className="flex justify-between"><span>Late</span><span className="tabular-nums text-danger-600 dark:text-danger-400">{counts.late}</span></li>
          </ul>
        </div>

        <div className="card">
          <CardHead title="Movements this quarter" note="what changed its dates" />
          {movements.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Nothing moved this quarter.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-200/70 dark:divide-white/10">
              {movements.slice(0, 4).map((movement) => (
                <li key={movement.id} className="py-2 text-sm">
                  <p className="font-medium leading-5">{movement.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Moved from {formatDate(movement.from)} to {formatDate(movement.to)}
                    {movement.ownerUserId ? ` · ${nameOf(movement.ownerUserId) ?? "someone"}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <CardHead title="The team's week" note="whoever owns it" />
          {week.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Nothing is planned for this week.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-200/70 dark:divide-white/10">
              {week.slice(0, 5).map((item) => (
                <li key={item.id} className="flex items-center gap-2.5 py-2 text-sm">
                  <PersonMark name={nameOf(item.ownerUserId) ?? "Unassigned"} late={item.signal === "LATE"} />
                  <span className="min-w-0 flex-1">
                    <Link className="block truncate hover:underline" href={`/projects/${projectId}/activities/plan/${item.id}`}>
                      {item.title}
                    </Link>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(item.date)}</span>
                  </span>
                  <Badge tone={item.signal === "LATE" ? "danger" : item.signal === "DONE" ? "success" : "neutral"}>
                    {item.signal === "LATE" ? "Late" : item.signal === "DONE" ? "Done" : "On time"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <CardHead title="Outputs" note="done of planned, beside indicators" />
          {outputs.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No outputs are linked to planned work yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-200/70 dark:divide-white/10">
              {outputs.map((output) => (
                <li key={output.outputId ?? "other"} className="py-2 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">{output.title}</span>
                    <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-300">
                      {output.done} of {output.planned} done
                    </span>
                  </div>
                  {output.late > 0 ? <p className="text-xs text-danger-600 dark:text-danger-400">{countOf(output.late, "activity", "activities")} late</p> : null}
                  {output.indicators.map((indicator) => (
                    <p key={indicator.code} className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {indicator.code} {indicator.name}: {indicator.percent} of target
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </OverviewSection>
  );
}

function healthTone(band: string): "success" | "warning" | "danger" | "neutral" {
  switch (band) {
    case "ON_TRACK": return "success";
    case "AT_RISK": return "warning";
    case "OFF_TRACK": return "danger";
    default: return "neutral";
  }
}
