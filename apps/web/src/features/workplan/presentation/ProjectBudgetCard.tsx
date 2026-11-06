import Link from "next/link";
import { formatMinor } from "@donordesk/domain/contexts/workplan/index.js";
import type { ProjectBudget } from "@/lib/server/schemas";

/**
 * The project's budget against spending, one block per currency (currencies are never added together) and a row per activity.
 * Over budget is stated in words, not only colour. Shown only when some activity has a budget.
 */
export function ProjectBudgetCard({ projectId, data }: { projectId: string; data: ProjectBudget["items"] }) {
  if (data.length === 0) return null;
  return (
    <section className="card mt-4 space-y-4" aria-labelledby="project-budget-title">
      <h3 id="project-budget-title" className="font-medium">Budget and spending</h3>
      {data.map((c) => (
        <div key={c.currency} className="space-y-2">
          <p className="text-sm">
            <b>{c.currency}</b>: budget <span className="font-mono">{formatMinor(c.budgetedMinor, c.currency)}</span>, spent <span className="font-mono">{formatMinor(c.spentMinor, c.currency)}</span>,{" "}
            {c.remainingMinor >= 0 ? <>left <span className="font-mono">{formatMinor(c.remainingMinor, c.currency)}</span></> : <span className="font-medium text-danger-600">over by <span className="font-mono">{formatMinor(-c.remainingMinor, c.currency)}</span></span>}
            {c.overspentActivities > 0 && <span className="text-danger-600"> · {c.overspentActivities} {c.overspentActivities === 1 ? "activity is" : "activities are"} over budget</span>}
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500"><th scope="col" className="py-1 pr-3 font-medium">Activity</th><th scope="col" className="py-1 pr-3 font-medium">Budget</th><th scope="col" className="py-1 pr-3 font-medium">Spent</th><th scope="col" className="py-1 font-medium">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                {c.byActivity.map((a) => (
                  <tr key={a.activityId}>
                    <td className="py-1 pr-3"><Link className="text-brand-700 hover:underline dark:text-brand-300" href={`/projects/${projectId}/activities/plan/${a.activityId}`}>{a.activityTitle}</Link></td>
                    <td className="py-1 pr-3 font-mono">{formatMinor(a.budgetedMinor, c.currency)}</td>
                    <td className="py-1 pr-3 font-mono">{formatMinor(a.spentMinor, c.currency)}</td>
                    <td className={`py-1 ${a.overspent ? "font-medium text-danger-600" : ""}`}>{a.overspent ? "Over budget" : a.spentMinor === 0 ? "Nothing spent yet" : "Within budget"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}
