import Link from "next/link";
import { countOf } from "@donordesk/domain/core/plural.js";
import { Badge } from "@/components/data/Badge";
import { formatDate } from "@/lib/shared/dates";
import { AskPanel } from "@/features/tasks/presentation/AskPanel";
import type { ProjectPerson } from "@/features/tasks/domain/ask-people";
import type { TeamData } from "@/features/projects/application/overview-view";
import { CardHead, OverviewSection, PersonMark } from "./overview-pieces";

/**
 * Who is carrying what and who needs help: each person's open, late and due-this-week counts, and
 * the requests waiting on this project.
 */
export function TeamSection({
  team,
  people,
  projectId,
  today,
  periods,
}: {
  team: TeamData;
  people: ProjectPerson[];
  projectId: string;
  today: string;
  periods: { id: string; label: string }[];
}) {
  return (
    <OverviewSection kicker="Team" title="Who is carrying what" href={`/projects/${projectId}/team`} linkLabel="Project team">
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="card">
          <CardHead title="Workload and lateness" note="open · late · due this week" />
          {team.rows.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No one has open work on this project.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <th scope="col" className="py-1.5 pr-3">Person</th>
                    <th scope="col" className="py-1.5 pr-3 text-right">Open</th>
                    <th scope="col" className="py-1.5 pr-3 text-right">Late</th>
                    <th scope="col" className="py-1.5 text-right">This week</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                  {team.rows.map((row) => (
                    <tr key={row.userId}>
                      <td className="py-1.5 pr-3">
                        <span className="flex items-center gap-2">
                          <PersonMark name={row.name} late={row.late > 0} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{row.name}</span>
                            {row.role ? <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{row.role}</span> : null}
                          </span>
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{row.open}</td>
                      <td className={`py-1.5 pr-3 text-right tabular-nums ${row.late > 0 ? "font-semibold text-danger-600 dark:text-danger-400" : ""}`}>{row.late}</td>
                      <td className="py-1.5 text-right tabular-nums">{row.dueThisWeek}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <CardHead
            title="Requests"
            action={<Badge tone={team.requests.length > 0 ? "info" : "neutral"}>{team.requests.length === 0 ? "None open" : countOf(team.requests.length, "request", "requests")}</Badge>}
          />
          {team.requests.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No requests are open on this project.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-200/70 dark:divide-white/10">
              {team.requests.slice(0, 5).map((request) => (
                <li key={request.key} className="py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <Link className="min-w-0 break-words leading-5 hover:underline" href={request.href}>
                      {request.title}
                    </Link>
                    <Badge tone={request.state === "LATE" ? "danger" : "neutral"}>{request.state === "LATE" ? "Overdue" : "Open"}</Badge>
                  </div>
                  {request.dueDate || request.assignee ? (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {request.assignee ? `for ${request.assignee}` : ""}
                      {request.assignee && request.dueDate ? " · " : ""}
                      {request.dueDate ? `due ${formatDate(request.dueDate)}` : ""}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <AskPanel
              projectId={projectId}
              kind="OTHER"
              buttonLabel="Ask for something"
              people={people}
              suggestedDue={suggestedDue(today)}
              periods={periods}
              variant="secondary"
            />
          </div>
        </div>
      </div>
    </OverviewSection>
  );
}

function suggestedDue(today: string): string {
  const date = new Date(`${today.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 3);
  return date.toISOString().slice(0, 10);
}
