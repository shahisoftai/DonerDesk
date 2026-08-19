import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { getBillingSummaryAction } from "@/lib/actions/billing";
import { InlineError } from "@/components/feedback/PageState";
import { BillingPanel } from "@/features/billing/presentation/BillingPanel";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const ctx = await requireSession();
  const canManage = hasCapability(ctx, "billing.manage") || hasCapability(ctx, "org.manage");

  const summary = await getBillingSummaryAction();
  if (!summary.ok) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight">Billing & plan</h1>
        <div className="mt-6">
          <InlineError title={summary.error.message} referenceId={summary.error.referenceId} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">Billing &amp; plan</h1>
      <BillingPanel summary={summary.value} canManage={canManage} />
    </div>
  );
}
