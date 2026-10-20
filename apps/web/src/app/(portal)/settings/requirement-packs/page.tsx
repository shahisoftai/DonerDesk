import { notFound } from "next/navigation";
import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { RequirementPacksResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { RequirementPackManager } from "@/features/requirement-packs/presentation/RequirementPackManager";

export const dynamic = "force-dynamic";

/** What a donor requires of a report, written once as plain lines. An active pack is checked before a report can be approved. */
export default async function RequirementPacksPage() {
  const ctx = await requireSession();
  if (!hasCapability(ctx, "template.edit")) notFound();
  const result = await gatewayRequest("/v1/reporting-requirement-packs", RequirementPacksResponseSchema, ctx.token);
  return (
    <div className="animate-fade-in space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Donor requirements</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          List what a donor requires of a report. Once a pack is active, a report that is missing a mandatory item cannot be approved, and the report says which one.
        </p>
      </header>
      {result.ok ? <RequirementPackManager packs={result.value.items} /> : <InlineError title={result.error.message} referenceId={result.error.referenceId} />}
    </div>
  );
}
