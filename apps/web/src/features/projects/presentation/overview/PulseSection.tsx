import { countOf } from "@donordesk/domain/core/plural.js";
import { formatDate } from "@/lib/shared/dates";
import type { PulseData } from "@/features/projects/application/overview-view";
import { Bar, OverviewSection, PaceBars, StatCard } from "./overview-pieces";

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
          value={delivery ? (delivery.planned > 0 ? `${delivery.done} of ${delivery.planned}` : "—") : "—"}
          hint={delivery ? (delivery.planned === 0 ? "No planned activities yet" : `activities done · ${delivery.reasons.join(" · ") || "nothing late"}`) : "Not available"}
          href={`/projects/${projectId}/activities/plan`}
        >
          {delivery && delivery.planned > 0 ? (
            <div className="mt-2">
              <Bar value={delivery.planned > 0 ? Math.round((delivery.done / delivery.planned) * 100) : 0} tone={healthTone(delivery.band)} />
            </div>
          ) : null}
        </StatCard>

        <StatCard
          label="Results pace"
          badge={results && results.measured > 0 ? { tone: results.behind > 0 ? "warning" : "success", text: results.behind > 0 ? "Watch" : "On pace" } : undefined}
          value={results && results.measured > 0 ? (results.behind > 0 ? `${results.behind} of ${results.measured} behind` : "None behind") : "—"}
          hint={
            results && results.measured > 0
              ? `${results.atOrAhead} on pace or ahead of the clock · ${countOf(results.notMeasured, "indicator", "indicators")} not measured yet`
              : "No indicator has a recorded value yet"
          }
          href={`/projects/${projectId}/data`}
        />

        <StatCard
          label="Budget pace"
          badge={budget ? { tone: budgetTone(budget.pace[0]?.spentPercent ?? null, budget.timeElapsedPercent), text: budgetLabel(budget.pace[0]?.spentPercent ?? null, budget.timeElapsedPercent) } : undefined}
          value={budget && budget.pace[0] && budget.pace[0].spentPercent !== null ? `${budget.pace[0].spentPercent}% spent` : "—"}
          hint={
            budget && budget.pace[0]
              ? `${budget.pace[0].currency} ${money(budget.pace[0].expenditure)} of ${money(budget.pace[0].budget)}${budget.pace[0].verifiedThrough ? ` · verified to ${budget.pace[0].verifiedThrough}` : " · not verified yet"}${budget.pace.length > 1 ? ` · ${budget.pace.length - 1} more currency on the Finance page` : ""}`
              : "No finance figures recorded"
          }
          href={`/projects/${projectId}/finance`}
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
          badge={nextDeadline ? deadlineBadge(nextDeadline.days) : undefined}
          value={nextDeadline ? `${nextDeadline.readiness}% ready` : "—"}
          hint={nextDeadline ? `${nextDeadline.title} · due ${formatDate(nextDeadline.date)}` : "No report is waiting to be sent"}
          href={nextDeadline ? `/projects/${projectId}/reports` : undefined}
        >
          {nextDeadline ? (
            <div className="mt-2">
              <Bar value={nextDeadline.readiness} tone={nextDeadline.readiness >= 75 ? "success" : nextDeadline.readiness >= 40 ? "warning" : "danger"} />
            </div>
          ) : null}
        </StatCard>

        <StatCard
          label="People reached"
          value={people && people.total > 0 ? people.total.toLocaleString("en") : "—"}
          hint={
            !people ? "Not available" : people.total === 0 ? "No one registered yet"
              : `registered people · ${people.bySex.filter((s) => s.count > 0).map((s) => `${s.count.toLocaleString("en")} ${s.label.toLowerCase()}`).join(" · ")}`
          }
          href={`/projects/${projectId}/beneficiaries`}
        />

        <StatCard
          label="Compliance"
          badge={compliance ? { tone: compliance.needsPerson > 0 ? "warning" : "success", text: compliance.needsPerson > 0 ? `${compliance.needsPerson} need a person` : "Nothing open" } : undefined}
          value={compliance ? countOf(compliance.open, "open item", "open items") : "—"}
          hint={compliance ? `${countOf(compliance.settled, "item", "items")} already closed` : "Not available"}
          href={`/projects/${projectId}/compliance`}
        />
      </div>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        {time.daysRemaining > 0
          ? `${countOf(time.daysRemaining, "day", "days")} left on the project (ends ${formatDate(time.endDate)}). Time elapsed ${time.timeElapsedPercent}%.`
          : `The project ended on ${formatDate(time.endDate)}.`}
      </p>
    </OverviewSection>
  );
}

function deadlineBadge(days: number): { tone: "danger" | "warning" | "neutral"; text: string } {
  if (days < 0) return { tone: "danger", text: `${countOf(-days, "day", "days")} late` };
  if (days === 0) return { tone: "warning", text: "Due today" };
  return { tone: days <= 3 ? "warning" : "neutral", text: `${countOf(days, "day", "days")} left` };
}

/** Whole amounts with thousands separators, cents only when there are any. */
function money(amount: number): string {
  return amount.toLocaleString("en", { maximumFractionDigits: 2 });
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
  if (spentPercent < elapsedPercent - 15) return "warning";
  return "success";
}

/** The same reading in words: what the pace means, not just its colour. */
function budgetLabel(spentPercent: number | null, elapsedPercent: number): string {
  if (spentPercent === null) return "Nothing recorded";
  if (spentPercent > elapsedPercent + 5) return "Spending ahead";
  if (spentPercent < elapsedPercent - 15) return "Spending behind";
  return "In step with time";
}
