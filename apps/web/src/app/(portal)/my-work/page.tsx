import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { AssignmentsResponseSchema, NotificationsResponseSchema, ProjectsResponseSchema, TeamWorkResponseSchema, WorkPlanResponseSchema } from "@/lib/server/schemas";
import { decodeSessionPayload } from "@/lib/shared/jwt-session";
import { WORKPLAN_COPY } from "@donordesk/domain/contexts/workplan/index.js";
import { InlineError } from "@/components/feedback/PageState";
import { loadProjectPeople } from "@/features/tasks/application/project-people";
import { MyWorkPanel } from "@/features/tasks/presentation/MyWorkPanel";
import { AskPanel } from "@/features/tasks/presentation/AskPanel";
import { suggestTaskDueDate } from "@donordesk/domain/contexts/tasks/index.js";

export const dynamic = "force-dynamic";

/**
 * My Work: one grouped list of everything that is mine (plan items, requests, compliance items, reports I lead, reviews I am
 * asked for because of my role). Managers get a second tab, Team: people with counts; choose a person to read their list.
 */
export default async function MyWorkPage({ searchParams }: { searchParams: Promise<{ tab?: string; project?: string; person?: string }> }) {
  const { tab, project, person } = await searchParams;
  const ctx = await requireSession();
  const userId = decodeSessionPayload(ctx.token)?.sub ?? "";
  const canTeam = ctx.capabilities.has("team.view-work");
  const showTeam = canTeam && tab === "team";

  const heading = (
    <>
      <h1 className="text-xl font-semibold tracking-tight">My work</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Everything that is yours, by when it is due.</p>
      {canTeam && (
        <nav aria-label="My work" className="mt-4 flex gap-2">
          <Link href="/my-work" aria-current={!showTeam ? "page" : undefined} className={`rounded-full px-3 py-1 text-sm ${!showTeam ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200"}`}>Mine</Link>
          <Link href="/my-work?tab=team" aria-current={showTeam ? "page" : undefined} className={`rounded-full px-3 py-1 text-sm ${showTeam ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200"}`}>Team</Link>
        </nav>
      )}
    </>
  );

  if (showTeam) return <TeamTab heading={heading} token={ctx.token} userId={userId} canAsk={ctx.capabilities.has("task.assign")} projectId={project} personId={person} />;

  const [mine, notifications] = await Promise.all([
    gatewayRequest("/v1/me/assignments", AssignmentsResponseSchema, ctx.token),
    gatewayRequest("/v1/notifications", NotificationsResponseSchema, ctx.token),
  ]);
  if (!mine.ok) return <div className="animate-fade-in">{heading}<div className="mt-6"><InlineError title={mine.error.message} referenceId={mine.error.referenceId} /></div></div>;

  // Names for "asked by": the people of every project that has a request.
  const projectIds = [...new Set(mine.value.groups.flatMap((g) => g.items.filter((i) => i.kind === "TASK").map((i) => i.projectId)))];
  const names: Record<string, string> = {};
  for (const people of await Promise.all(projectIds.map((id) => loadProjectPeople(ctx.token, id, userId)))) for (const p of people) names[p.id] = p.label.replace(/ \(you\)$/, "");
  const unread = notifications.ok ? notifications.value.items.filter((n) => !n.read).slice(0, 10) : [];

  return (
    <div className="animate-fade-in">
      {heading}
      <MyWorkPanel data={mine.value} names={names} userId={userId} mine />
      {unread.length > 0 && (
        <section className="mt-8" aria-labelledby="mw-notes">
          <h2 id="mw-notes" className="text-sm font-semibold">Notifications <span className="font-normal text-slate-500">({unread.length})</span></h2>
          <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-white/10 dark:border-white/10">
            {unread.map((n) => (
              <li key={n.id} className="p-3 text-sm"><span className="font-medium">{n.title}</span>{n.message ? <span className="text-slate-600 dark:text-slate-300"> · {n.message}</span> : null}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm"><Link className="text-brand-700 hover:underline dark:text-brand-300" href="/notifications">All notifications</Link></p>
        </section>
      )}
    </div>
  );
}

async function TeamTab({ heading, token, userId, canAsk, projectId, personId }: { heading: React.ReactNode; token: string; userId: string; canAsk: boolean; projectId?: string | undefined; personId?: string | undefined }) {
  const projects = await gatewayRequest("/v1/projects", ProjectsResponseSchema, token);
  if (!projects.ok) return <div className="animate-fade-in">{heading}<div className="mt-6"><InlineError title={projects.error.message} referenceId={projects.error.referenceId} /></div></div>;
  const list = projects.value.items.filter((p) => p.status === "ACTIVE" || p.status === "DRAFT" || p.status === "PAUSED");
  const chosen = list.find((p) => p.id === projectId) ?? list[0];
  if (!chosen) return <div className="animate-fade-in">{heading}<p className="mt-6 text-sm text-slate-600 dark:text-slate-300">There are no active projects.</p></div>;

  const [team, people, theirs, plan] = await Promise.all([
    gatewayRequest(`/v1/projects/${chosen.id}/team-work`, TeamWorkResponseSchema, token),
    loadProjectPeople(token, chosen.id, userId),
    personId ? gatewayRequest(`/v1/me/assignments?userId=${encodeURIComponent(personId)}&projectId=${encodeURIComponent(chosen.id)}`, AssignmentsResponseSchema, token) : Promise.resolve(null),
    canAsk ? gatewayRequest(`/v1/projects/${chosen.id}/work-plan`, WorkPlanResponseSchema, token) : Promise.resolve(null),
  ]);
  // "Ask for completed activity" lives here (plan §16b), not on the item page: the manager picks one of the open activities.
  const openItems = plan?.ok ? plan.value.items.filter((i) => i.status === "PLANNED" || i.status === "IN_PROGRESS") : [];
  const names: Record<string, string> = Object.fromEntries(people.map((p) => [p.id, p.label.replace(/ \(you\)$/, "")]));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="animate-fade-in">
      {heading}
      <form className="mt-4 flex items-end gap-2" action="/my-work" method="get">
        <input type="hidden" name="tab" value="team" />
        <label className="text-sm">Project
          <select name="project" defaultValue={chosen.id} className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-white/15 dark:bg-slate-900/60">
            {list.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </label>
        <button className="btn-secondary text-xs" type="submit">Show</button>
      </form>

      {!team.ok ? <div className="mt-6"><InlineError title={team.error.message} referenceId={team.error.referenceId} /></div> : team.value.rows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">Nobody has open work in this project.</p>
      ) : (
        <table className="mt-6 w-full max-w-2xl text-sm">
          <thead className="text-left text-xs text-slate-500"><tr><th className="py-1 font-medium">Person</th><th className="font-medium">Late</th><th className="font-medium">Due this week</th><th className="font-medium">Open</th></tr></thead>
          <tbody>
            {team.value.rows.map((r) => (
              <tr key={r.assigneeId} className="border-t border-slate-200 dark:border-white/10">
                <td className="py-2"><Link className="text-brand-700 hover:underline dark:text-brand-300" href={`/my-work?tab=team&project=${chosen.id}&person=${r.assigneeId}`}>{names[r.assigneeId] ?? "A team member"}</Link></td>
                <td className={r.late > 0 ? "font-medium text-red-600" : ""}>{r.late}</td><td>{r.dueThisWeek}</td><td>{r.open}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {theirs?.ok && (
        <section className="mt-8" aria-label="Their work">
          <h2 className="text-sm font-semibold">{names[personId!] ?? "A team member"}</h2>
          <MyWorkPanel data={theirs.value} names={names} userId={userId} mine={false} />
        </section>
      )}

      {canAsk && (
        <section className="mt-8" aria-label="Ask someone">
          <div className="flex flex-wrap gap-3">
            <AskPanel projectId={chosen.id} kind="OTHER" buttonLabel="Ask someone…" people={people} suggestedDue={suggestTaskDueDate("OTHER", { today })} />
            {openItems.length > 0 && (
              <AskPanel projectId={chosen.id} kind="RECORD_ACTIVITY" buttonLabel={WORKPLAN_COPY.askForCompleted} subjects={openItems.map((i) => ({ id: i.id, title: i.title }))} people={people} suggestedDue={suggestTaskDueDate("RECORD_ACTIVITY", { today })} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
