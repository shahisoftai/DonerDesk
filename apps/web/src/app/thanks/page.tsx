import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { verifyCreemRedirectSignature } from "@/lib/server/creem-redirect";

export const metadata: Metadata = {
  title: "Payment confirmed",
  description: "Your DonorDesk payment was successful.",
};

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function ThanksPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const checkoutId = first(params.checkout_id);
  const orderId = first(params.order_id);
  const productId = first(params.product_id);
  const requestId = first(params.request_id);

  const headerStore = await headers();
  const rawQuery = headerStore.get("x-url")?.split("?")[1] ?? "";
  const apiKey = process.env.CREEM_API_KEY ?? "";
  const signatureOk = verifyCreemRedirectSignature(rawQuery, apiKey);

  return (
    <main className="mx-auto mt-24 max-w-lg animate-fade-in px-6">
      <div className="card space-y-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/15">
          <svg viewBox="0 0 24 24" className="h-9 w-9 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Thank you — payment confirmed</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Your plan is active and your upgraded workspace is ready. Your team can keep working exactly where you left
            off — nothing was interrupted.
          </p>
        </div>

        {(checkoutId || orderId) && (
          <dl className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-left text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
            {checkoutId && (
              <div className="flex justify-between gap-4 py-0.5">
                <dt>Checkout reference</dt>
                <dd className="font-mono text-slate-700 dark:text-slate-300">{checkoutId}</dd>
              </div>
            )}
            {orderId && (
              <div className="flex justify-between gap-4 py-0.5">
                <dt>Order</dt>
                <dd className="font-mono text-slate-700 dark:text-slate-300">{orderId}</dd>
              </div>
            )}
            {requestId && (
              <div className="flex justify-between gap-4 py-0.5">
                <dt>Request</dt>
                <dd className="font-mono text-slate-700 dark:text-slate-300">{requestId}</dd>
              </div>
            )}
            {productId && (
              <div className="flex justify-between gap-4 py-0.5">
                <dt>Product</dt>
                <dd className="font-mono text-slate-700 dark:text-slate-300">{productId}</dd>
              </div>
            )}
          </dl>
        )}

        <div className="space-y-2 pt-1">
          <Link href="/dashboard" className="btn block w-full">
            Go to your workspace
          </Link>
          <Link href="/settings/billing" className="btn-secondary block w-full">
            Manage billing
          </Link>
        </div>

        {!signatureOk && apiKey && (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Payment confirmation is processed automatically and may take a minute to appear in your workspace.
          </p>
        )}
      </div>
    </main>
  );
}
