import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { CheckoutResponseSchema } from "@/lib/server/billing-schemas";
import { InlineError } from "@/components/feedback/PageState";

export const dynamic = "force-dynamic";

const VALID_PLANS = new Set(["TEAM", "GROWTH"]);
const VALID_INTERVALS = new Set(["MONTH", "YEAR"]);

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Checkout redirect page. Used right after a paid-plan signup and from the
 * pricing page: the browser never sees a product id or success URL — the API
 * creates the Creem checkout session for the authenticated tenant and this page
 * hands the user off to the hosted checkout. This page never grants access by
 * itself; the webhook + reconciliation are authoritative.
 */
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const rawPlan = first(params.plan);
  const rawInterval = first(params.interval);
  const plan = rawPlan?.toUpperCase() ?? "";
  const interval = rawInterval?.toUpperCase() ?? "MONTH";

  if (!VALID_PLANS.has(plan)) {
    return (
      <main className="mx-auto mt-24 max-w-md animate-fade-in px-6">
        <div className="card space-y-4">
          <h1 className="text-2xl font-bold">Continue to payment</h1>
          <InlineError title="Please choose a plan (Team or Growth) to continue." />
          <Link href="/settings/billing" className="btn-secondary block w-full text-center">
            Back to billing
          </Link>
        </div>
      </main>
    );
  }

  const intervalValue = VALID_INTERVALS.has(interval) ? (interval as "MONTH" | "YEAR") : "MONTH";

  const ctx = await requireSession();
  const result = await gatewayRequest("/v1/billing/checkout", CheckoutResponseSchema, ctx.token, {
    method: "POST",
    body: { plan, interval: intervalValue },
  });
  if (!result.ok) {
    return (
      <main className="mx-auto mt-24 max-w-md animate-fade-in px-6">
        <div className="card space-y-4">
          <h1 className="text-2xl font-bold">Continue to payment</h1>
          <InlineError title={result.error.message} />
          <Link href="/settings/billing" className="btn-secondary block w-full text-center">
            Back to billing
          </Link>
        </div>
      </main>
    );
  }

  redirect(result.value.url);
}
