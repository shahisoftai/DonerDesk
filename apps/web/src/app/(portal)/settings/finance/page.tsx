import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { BudgetCategoryListSchema, FundingSourceListSchema, RatesSchema } from "@/lib/server/schemas-finance";
import { InlineError } from "@/components/feedback/PageState";
import { FINANCE_COPY as C } from "@/features/finance/domain/finance-copy";
import { todayText } from "@/features/finance/domain/finance-view";
import { FinanceSettingsPanel } from "@/features/finance/presentation/FinanceSettingsPanel";

export const dynamic = "force-dynamic";

export default async function FinanceSettingsPage() {
  const ctx = await requireSession();
  const [sources, rates, categories] = await Promise.all([
    gatewayRequest("/v1/finance/funding-sources", FundingSourceListSchema, ctx.token),
    gatewayRequest("/v1/finance/rates", RatesSchema, ctx.token),
    gatewayRequest("/v1/finance/budget-categories", BudgetCategoryListSchema, ctx.token),
  ]);
  const failed = [sources, rates, categories].find((r) => !r.ok);
  if (failed && !failed.ok) return <InlineError title={failed.error.message} referenceId={failed.error.referenceId} />;
  if (!sources.ok || !rates.ok || !categories.ok) return null;
  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">{C.settingsTitle}</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">{C.settingsIntro}</p>
      <div className="mt-6">
        <FinanceSettingsPanel sources={sources.value.sources} rates={rates.value} categories={categories.value.categories} canEdit={hasCapability(ctx, "org.manage")} today={todayText(new Date())} />
      </div>
    </div>
  );
}
