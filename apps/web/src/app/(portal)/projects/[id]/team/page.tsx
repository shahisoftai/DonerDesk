import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { getProjectMembers } from "@/lib/server/project-queries";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { TeamResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { ProjectTeamPanel } from "@/features/team/presentation/ProjectTeamPanel";

export const dynamic = "force-dynamic";

export default async function ProjectTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await requireSession();
  const canManage = hasCapability(ctx, "team.manage") || hasCapability(ctx, "team.invite");

  const [membersResult, usersResult] = await Promise.all([
    getProjectMembers(ctx.token, resolvedParams.id),
    gatewayRequest("/v1/users", TeamResponseSchema, ctx.token),
  ]);

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold">Project team</h2>
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
      {!canManage && (
        <p className="mt-3 text-sm text-slate-500">You do not have permission to change team access.</p>
      )}
    </div>
  );
}
