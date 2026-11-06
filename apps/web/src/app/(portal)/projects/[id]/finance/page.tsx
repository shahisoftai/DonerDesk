import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectFinanceSchema } from "@/lib/server/schemas-finance";
import { InlineError } from "@/components/feedback/PageState";
import { FINANCE_COPY as C } from "@/features/finance/domain/finance-copy";
import { todayText } from "@/features/finance/domain/finance-view";
import { FinanceSummary } from "@/features/finance/presentation/FinanceSummary";
import { BudgetSection } from "@/features/finance/presentation/BudgetSection";
import { FundingSection } from "@/features/finance/presentation/FundingSection";
import { RegisterSection } from "@/features/finance/presentation/RegisterSection";
import { AdvancesSection } from "@/features/finance/presentation/AdvancesSection";
import { ImportSection } from "@/features/finance/presentation/ImportSection";
import { DeliverablesSection } from "@/features/finance/presentation/DeliverablesSection";

export const dynamic = "force-dynamic";

/** A project's finance (Phase 35.F): where the money stands, funding, budget against spending, the register, advances and payment milestones. */
export default async function FinancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const finance = await gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/finance`, ProjectFinanceSchema, ctx.token);
  if (!finance.ok) return <InlineError title={finance.error.message} referenceId={finance.error.referenceId} />;
  const f = finance.value;
  const canEdit = hasCapability(ctx, "project.edit");
  const canApprove = hasCapability(ctx, "finance.approve");
  const canExpense = hasCapability(ctx, "workplan.update-own");
  const today = todayText(new Date());
  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{C.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">{C.intro}</p>
        {!canEdit && !canApprove && !canExpense && <p className="mt-2 text-xs text-slate-500">{C.viewerNote}</p>}
      </div>
      <FinanceSummary f={f} />
      <FundingSection projectId={id} f={f} canEdit={canEdit} today={today} />
      <BudgetSection f={f} />
      <RegisterSection projectId={id} f={f} canEnterExpense={canExpense} canEnterMoney={canEdit} today={today} />
      {canExpense && <ImportSection projectId={id} />}
      <AdvancesSection projectId={id} f={f} canEdit={canEdit} today={today} />
      <DeliverablesSection projectId={id} f={f} canEdit={canEdit} canApprove={canApprove} today={today} />
    </div>
  );
}
