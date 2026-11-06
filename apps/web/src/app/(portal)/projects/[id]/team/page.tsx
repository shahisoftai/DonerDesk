import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { getProjectMembers } from "@/lib/server/project-queries";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { AutomationHistorySchema, AutomationRulesResponseSchema, TeamResponseSchema, WorkloadResponseSchema } from "@/lib/server/schemas";
import { AutomationHistoryCard } from "@/features/workplan/presentation/AutomationHistoryCard";
import { AutomationRulesCard } from "@/features/workplan/presentation/AutomationRulesCard";
import { EntryDueDaysCard } from "@/features/workplan/presentation/EntryDueDaysCard";
import { getEntryDueDaysAction } from "@/lib/actions/entry-due-days";
import { WorkloadPanel } from "@/features/workplan/presentation/WorkloadPanel";
import { loadProjectPeople } from "@/features/tasks/application/project-people";
import { decodeSessionPayload } from "@/lib/shared/jwt-session";
import { InlineError } from "@/components/feedback/PageState";
import { ProjectTeamPanel } from "@/features/team/presentation/ProjectTeamPanel";

export const dynamic = "force-dynamic";

export default async function ProjectTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await requireSession();
  const canManage = hasCapability(ctx, "team.manage") || hasCapability(ctx, "team.invite");

  const [membersResult, usersResult, workload] = await Promise.all([
    getProjectMembers(ctx.token, resolvedParams.id),
    gatewayRequest("/v1/users", TeamResponseSchema, ctx.token),
    gatewayRequest(`/v1/projects/${resolvedParams.id}/workload`, WorkloadResponseSchema, ctx.token),
  ]);
  const history = canManage ? await gatewayRequest(`/v1/projects/${resolvedParams.id}/automation-history`, AutomationHistorySchema, ctx.token) : null;
  const dueDays = canManage ? await getEntryDueDaysAction(resolvedParams.id) : null;
  const automations = canManage ? await gatewayRequest(`/v1/projects/${resolvedParams.id}/automations`, AutomationRulesResponseSchema, ctx.token) : null;
  const people = await loadProjectPeople(ctx.token, resolvedParams.id, decodeSessionPayload(ctx.token)?.sub ?? "");
  const names = Object.fromEntries(people.map((p) => [p.id, p.label.replace(/ \(you\)$/, "")]));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-semibold tracking-tight">Project team</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Roles here are scoped to this project. Changes are audited.
      </p>
      {!membersResult.ok && <div className="mt-4"><InlineError title={membersResult.error.message} referenceId={membersResult.error.referenceId} /></div>}
      {membersResult.ok && (
        <div className="mt-4">
          <ProjectTeamPanel
            projectId={resolvedParams.id}
            members={membersResult.value}
            users={usersResult.ok ? usersResult.value.items : []}
            capabilities={Array.from(ctx.capabilities)}
          />
        </div>
      )}
      {workload.ok && (
        <div className="mt-8">
          <WorkloadPanel data={workload.value} names={names} today={today} canManage={canManage} />
        </div>
      )}
      {dueDays?.ok && (
        <div className="mt-8">
          <EntryDueDaysCard projectId={resolvedParams.id} days={dueDays.value.days} />
        </div>
      )}
      {history?.ok && (
        <div className="mt-8">
          <AutomationHistoryCard data={history.value} names={names} />
        </div>
      )}
      {automations?.ok && (
        <div className="mt-8">
          <AutomationRulesCard projectId={resolvedParams.id} data={automations.value} />
        </div>
      )}
      {!canManage && (
        <p className="mt-3 text-sm text-slate-500">You do not have permission to change team access.</p>
      )}
    </div>
  );
}
