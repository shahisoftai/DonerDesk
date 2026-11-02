import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { OrganisationPacksSchema } from "@/lib/server/schemas-setup-packs";
import { InlineError } from "@/components/feedback/PageState";
import { OrganisationPacksPanel } from "@/features/project-setup/presentation/OrganisationPacksPanel";

export const dynamic = "force-dynamic";

export default async function SetupPacksPage() {
  const ctx = await requireSession();
  if (!hasCapability(ctx, "org.manage")) return <InlineError title="Only an administrator can set the starting answers." />;
  const packs = await gatewayRequest("/v1/organization/setup-packs", OrganisationPacksSchema, ctx.token);
  if (!packs.ok) return <InlineError title={packs.error.message} referenceId={packs.error.referenceId} />;
  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">Starting answers for new projects</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
        When someone creates a project and chooses a sector, the wizard can fill in the usual answers for it: how often reports are due, the review mode,
        the entry window, the usual risks and a starting dashboard. Write your organisation&apos;s own here; where you have not, the ones that come with DonorDesk are used.
        They only fill what is still empty, never hold people or a donor, and every answer can be changed in the wizard.
      </p>
      <div className="mt-6"><OrganisationPacksPanel packs={packs.value} /></div>
    </div>
  );
}
