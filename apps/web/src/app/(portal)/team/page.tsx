import { requireSession } from "@/lib/server/auth-context";
import { hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { PendingInvitationsResponseSchema, TeamResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { TeamPanel } from "@/features/team/presentation/TeamPanel";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await requireSession();
  const canView = hasCapability(ctx, "team.manage") || hasCapability(ctx, "team.invite");
  if (!canView) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight">Team</h1>
        <div className="card mt-6 text-sm text-slate-600 dark:text-slate-300">
          You do not have permission to view the team.
        </div>
      </div>
    );
  }

  const result = await gatewayRequest("/v1/users", TeamResponseSchema, ctx.token);
  if (!result.ok) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight">Team</h1>
        <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>
      </div>
    );
  }

  // Outstanding invitations are a convenience beside the team; the page works without them.
  const pending = await gatewayRequest("/v1/users/invitations", PendingInvitationsResponseSchema, ctx.token);

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">Team</h1>
      <div className="mt-6">
        <TeamPanel
          pendingInvitations={pending.ok ? pending.value.items : []}
          members={result.value.items}
          capabilities={Array.from(ctx.capabilities)}
        />
      </div>
    </div>
  );
}
