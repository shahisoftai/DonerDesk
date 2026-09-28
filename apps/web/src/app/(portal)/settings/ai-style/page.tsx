import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { OrganizationProfileSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { AgentMemorySettingsPanel } from "@/features/agent-memory/presentation/AgentMemorySettingsPanel";

export const dynamic = "force-dynamic";

export default async function AiStyleSettingsPage() {
  const ctx = await requireSession();
  if (!hasCapability(ctx, "report.manage-agent-memory")) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight">AI Writing Style</h1>
        <div className="card mt-6 text-sm text-slate-600 dark:text-slate-300">
          You do not have permission to manage this setting.
        </div>
      </div>
    );
  }

  const org = await gatewayRequest("/v1/organization", OrganizationProfileSchema, ctx.token);
  if (!org.ok) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight">AI Writing Style</h1>
        <div className="mt-6"><InlineError title={org.error.message} referenceId={org.error.referenceId} /></div>
      </div>
    );
  }
  if (!org.value.agentMemoryPlatformEnabled) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight">AI Writing Style</h1>
        <div className="card mt-6 text-sm text-slate-600 dark:text-slate-300">This feature is not yet available for your account.</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">AI Writing Style</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Let the AI reporter learn your team&apos;s preferred wording and structure from the edits reviewers make to AI-drafted sections.
      </p>
      <div className="mt-6">
        <AgentMemorySettingsPanel initialEnabled={org.value.agentMemoryEnabled ?? false} />
      </div>
    </div>
  );
}
