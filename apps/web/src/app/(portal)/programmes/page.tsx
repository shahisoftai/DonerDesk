import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { FundingResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { FundingManager } from "@/features/funding/presentation/FundingManager";

export const dynamic = "force-dynamic";

/** Programmes, the grants under them and the projects delivered under each, with what each level adds up to. */
export default async function ProgrammesPage() {
  const ctx = await requireSession();
  const result = await gatewayRequest("/v1/funding", FundingResponseSchema, ctx.token);
  return (
    <div className="animate-fade-in space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Programmes and grants</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Group related awards and projects. Totals add up the projects you can see; budgets in different currencies are never added together.
        </p>
      </header>
      {result.ok ? <FundingManager funding={result.value} canManage={hasCapability(ctx, "project.create")} /> : <InlineError title={result.error.message} referenceId={result.error.referenceId} />}
    </div>
  );
}
