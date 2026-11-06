import { countOf } from "@donordesk/domain/core/plural.js";
import { Badge } from "@/components/data/Badge";
import type { CloseOutData } from "@/features/projects/application/overview-view";
import { CardHead, OverviewSection } from "./overview-pieces";

/**
 * What closing the project will need, in view from the start: the guided closing plan's own steps,
 * the final report, and how long is left.
 */
export function CloseOutSection({ closeOut, projectId }: { closeOut: CloseOutData; projectId: string }) {
  return (
    <OverviewSection kicker="Close-out" title="What closing the project will need" href={`/projects/${projectId}/reports/closing`} linkLabel="Closing report plan">
      <div className="card">
        <CardHead
          title={`${countOf(closeOut.monthsRemaining, "month", "months")} left`}
          note={closeOut.finalPeriod ? `The final report already exists: ${closeOut.finalPeriod.title}` : "The final report is not created yet"}
          action={<Badge tone={closeOut.todoCount > 0 ? "warning" : "success"}>{countOf(closeOut.todoCount, "thing", "things")} to do</Badge>}
        />
        {closeOut.steps.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">The closing plan has no steps yet.</p>
        ) : (
          <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {closeOut.steps.map((step) => (
              <li key={step.key} className="rounded-lg border border-slate-200/70 p-3 text-sm dark:border-white/10">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 font-medium">{step.label}</span>
                  <Badge tone={stepTone(step.status)}>{stepLabel(step.status)}</Badge>
                </div>
                {step.detail ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{step.detail}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </OverviewSection>
  );
}

function stepTone(status: string): "info" | "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "DONE":
    case "COMPLETE":
    case "COMPLETED": return "success";
    case "IN_PROGRESS":
    case "STARTED": return "info";
    case "BLOCKED":
    case "MISSING": return "danger";
    default: return "neutral";
  }
}

function stepLabel(status: string): string {
  switch (status) {
    case "DONE":
    case "COMPLETE":
    case "COMPLETED": return "Ready";
    case "IN_PROGRESS":
    case "STARTED": return "In progress";
    case "BLOCKED": return "Blocked";
    case "MISSING": return "Missing";
    case "NOT_STARTED": return "Not started";
    default: return status.replace(/_/g, " ").toLowerCase();
  }
}
