import { countOf } from "@donordesk/domain/core/plural.js";
import { formatDate } from "@/lib/shared/dates";
import type { PulseData } from "@/features/projects/application/overview-view";
import { Bar, CardHead, OverviewSection, PaceBars, StatCard } from "./overview-pieces";

/**
 * The programme in six numbers: how delivery stands, how the results are tracking against the clock,
 * how the money is tracking against the clock, the next deadline, the people reached and the open
 * compliance items.
 *
 * Nothing here is a score: pace is the share reached shown beside the share of time elapsed, and the
 * counts say exactly what was counted.
 */
export function PulseSection({ pulse, projectId }: { pulse: PulseData; projectId: string }) {
  const { delivery, results, budget, nextDeadline, people, compliance, time } = pulse;

  return (
    <OverviewSection kicker="Pulse" title="Where the programme stands today">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Delivery"
          badge={delivery ? { tone: healthTone(delivery.band), text: delivery.label } : undefined}
          value={delivery ? `${delivery.done} of ${delivery.planned}` : "—"}
          hint={delivery ? delivery.reasons.join(" · ") || "Nothing late" : "Not available"}
        >
          {delivery ? (
            <div className="mt-2">
              <Bar value={delivery.planned > 0 ? Math.round((delivery.done / delivery.planned) * 100) : 0} tone={healthTone(delivery.band)} />
            </div>
          ) : null}
        </StatCard>

        <StatCard
          label="Results pace"
          badge={results && results.measured > 0 ? { tone: results.behind > 0 ? "warning" : "success", text: results.behind > 0 ? "Watch" : "On pace" } : undefined}
          value={results && results.measured > 0 ? countOf(results.behind, "indicator", "indicators") + " behind" : "—"}
          hint={
            results && results.measured > 0
              ? `of ${countOf(results.measured, "measured indicator", "measured indicators")} measured · ${countOf(results.atOrAhead, "at the clock", "at the clock")} · ${countOf(results.notMeasured, "not measured", "not measured")}`
              : "No indicator has a recorded value yet"
          }
        />

        <StatCard
          label="Budget pace"
          badge={budget ? { tone: budgetTone(budget.pace[0]?.spentPercent ?? null, budget.timeElapsedPercent), text: budgetLabel(budget.pace[0]?.spentPercent ?? null, budget.timeElapsedPercent) } : undefined}
          value={budget && budget.pace[0] ? `${budget.pace[0].spentPercent ?? "—"}%` : "—"}
          hint={budget && budget.pace[0] ? `${budget.pace[0].currency} · ${budget.pace[0].expenditure.toLocaleString()} of ${budget.pace[0].budget.toLocaleString()}` : "No finance figures recorded"}
        >
          {budget ? (
            <PaceBars
              clockPercent={budget.timeElapsedPercent}
              reachedPercent={budget.pace[0]?.spentPercent ?? null}
              reachedLabel={budget.pace[0]?.spentPercent === null || budget.pace[0] === undefined ? "Nothing recorded" : `${budget.pace[0]?.spentPercent}% spent`}
            />
          ) : null}
        </StatCard>

        <StatCard
          label="Next deadline"
          badge={nextDeadline ? { tone: nextDeadline.days <= 3 ? "warning" : "neutral", text: nextDeadline.days <= 0 ? "Due today" : `${nextDeadline.days} days left` } : undefined}
          value={nextDeadline ? `${nextDeadline.readiness}%` : "—"}
          hint={nextDeadline ? `${nextDeadline.title} · ${formatDate(nextDeadline.date)}` : "No report is scheduled"}
        >
          {nextDeadline ? (
            <div className="mt-2">
              <Bar value={nextDeadline.readiness} tone={nextDeadline.readiness >= 75 ? "success" : nextDeadline.readiness >= 40 ? "warning" : "danger"} />
            </div>
          ) : null}
        </StatCard>

        <StatCard
          label="People reached"
          value={people ? people.total.toLocaleString() : "—"}
          hint={people ? people.bySex.map((s) => `${s.count.toLocaleString()} ${s.label.toLowerCase()}`).join(" · ") : "Not available"}
        />

        <StatCard
          label="Compliance"
          badge={compliance ? { tone: compliance.needsPerson > 0 ? "warning" : "success", text: compliance.needsPerson > 0 ? `${compliance.needsPerson} need a person` : "Nothing open" } : undefined}
          value={compliance ? countOf(compliance.open, "open item", "open items") : "—"}
          hint={compliance ? `${countOf(compliance.settled, "item", "items")} already closed` : "Not available"}
        >
          <a className="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${projectId}/compliance`}>
            Open compliance →
          </a>
        </StatCard>
      </div>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        {time.daysRemaining} days left on the project ({formatDate(time.endDate)}). Time elapsed {time.timeElapsedPercent}%.
      </p>
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

/** Spending ahead of the clock is a different problem from spending behind it, and reads differently. */
function budgetTone(spentPercent: number | null, elapsedPercent: number): "success" | "warning" | "danger" | "neutral" {
  if (spentPercent === null) return "neutral";
  if (spentPercent > elapsedPercent + 5) return "danger";
  if (spentPercent < elapsedPercent - 15) return "success";
  return "warning";
}

/** The same reading in words: what the pace means, not just its colour. */
function budgetLabel(spentPercent: number | null, elapsedPercent: number): string {
  if (spentPercent === null) return "Nothing recorded";
  if (spentPercent > elapsedPercent + 5) return "Spending ahead";
  if (spentPercent < elapsedPercent - 15) return "Spending behind";
  return "In step with time";
}
