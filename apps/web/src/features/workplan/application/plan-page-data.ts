import "server-only";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { requireSession, type AuthContext } from "@/lib/server/auth-context";
import { getProject } from "@/lib/server/project-queries";
import { decodeSessionPayload } from "@/lib/shared/jwt-session";
import { LogframeResponseSchema, OrganizationSchema } from "@/lib/server/schemas";
import { todayInZone } from "../domain/today-in-zone";
import { loadProjectPeople } from "@/features/tasks/application/project-people";
import type { ProjectPerson } from "@/features/tasks/domain/ask-people";
import type { PlanFormOption } from "../presentation/PlanActivityForm";
import type { WizardActivity } from "../presentation/StartFromLogframeWizard";

export interface PlanPageData {
  ctx: AuthContext;
  userId: string;
  today: string;
  /** False when an admin hid the work plan for this project. */
  planningVisible: boolean;
  /** Active members ("You" for the current person). */
  leads: PlanFormOption[];
  /** The same people with their roles, for the request dialog. */
  people: ProjectPerson[];
  names: Record<string, string>;
  logframeActivities: WizardActivity[];
  /** Output id -> title, for grouping the Timeline. */
  outputTitles: Record<string, string>;
  /** The project's dates (the Timeline's whole-project range). */
  projectRange: { start: string; end: string };
}

/** Everything the plan pages share: who the person is, who can lead, and the logframe's activities. One read, used by every plan page. */
export async function loadPlanPageData(projectId: string): Promise<PlanPageData> {
  const ctx = await requireSession();
  const userId = decodeSessionPayload(ctx.token)?.sub ?? "";
  const [project, people, logframe, org] = await Promise.all([
    getProject(ctx.token, projectId),
    loadProjectPeople(ctx.token, projectId, userId),
    gatewayRequest(`/v1/projects/${projectId}/logframe`, LogframeResponseSchema, ctx.token),
    gatewayRequest("/v1/organization", OrganizationSchema, ctx.token),
  ]);
  const names: Record<string, string> = Object.fromEntries(people.map((p) => [p.id, p.label.replace(/ \(you\)$/, "")]));
  const items = logframe.ok ? logframe.value.items : [];
  // The same "today" the server uses for what is late: the project's own time zone, else the organisation's, else UTC.
  const today = todayInZone(new Date(), (project.ok ? project.value.timeZone : undefined) || (org.ok ? org.value.timeZone : undefined));
  const titleOf = new Map(items.map((i) => [i.id, i.title]));
  return {
    ctx,
    userId,
    today,
    outputTitles: Object.fromEntries(items.filter((i) => i.level === "OUTPUT").map((i) => [i.id, i.code ? `${i.code} ${i.title}` : i.title])),
    projectRange: project.ok ? { start: project.value.startDate.slice(0, 10), end: project.value.endDate.slice(0, 10) } : { start: today, end: today },
    planningVisible: project.ok ? project.value.showWorkPlanning !== false : true,
    people,
    leads: people.map((p) => ({ id: p.id, label: p.label })),
    names,
    logframeActivities: items
      .filter((i) => i.level === "ACTIVITY")
      .map((i) => ({ id: i.id, title: i.code ? `${i.code} ${i.title}` : i.title, outputTitle: (i.parentId && titleOf.get(i.parentId)) || "Other activities" })),
  };
}
