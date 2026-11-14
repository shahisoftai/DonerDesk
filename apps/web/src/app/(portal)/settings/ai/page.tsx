import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { OrganizationProfileSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { PageHeader } from "@/components/layout/Page";
import { AskSettingsCard } from "@/features/ask/presentation/AskSettingsCard";
import { SetupAssistSettingsCard } from "@/features/project-setup/presentation/SetupAssistSettingsCard";

export const dynamic = "force-dynamic";

/** Every AI switch of the organisation on one page (Version 4.000, plan F29). */
export default async function AiSettingsPage() {
  const ctx = await requireSession();
  const org = await gatewayRequest("/v1/organization", OrganizationProfileSchema, ctx.token);
  if (!org.ok) return <InlineError title={org.error.message} referenceId={org.error.referenceId} />;
  const canEdit = ctx.capabilities.has("org.manage");
  return (
    <div className="page-stack animate-fade-in">
      <PageHeader
        title="AI features"
        description="What the assistant may do for your organisation. Every AI-written sentence is checked against your records and approved by a person."
        actions={canEdit ? <Link className="btn-secondary" href="/settings/ai-usage">See AI usage</Link> : undefined}
      />
      <AskSettingsCard initialEnabled={org.value.askEnabled === true} canEdit={canEdit} inPlan={org.value.askAccess !== "NOT_IN_PLAN"} />
      <SetupAssistSettingsCard initialEnabled={org.value.setupAssistEnabled === true} canEdit={canEdit} />
    </div>
  );
}
