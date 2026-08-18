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

const QUICK_LINKS: Array<{ href: string; title: string; description: string }> = [
  {
    href: "/onboarding",
    title: "Complete workspace setup",
    description: "Connect Google Drive, confirm your organization profile, set reporting defaults, and invite your team.",
  },
  {
    href: "/projects",
    title: "Create your first project",
    description: "Add a programme, its donor template, logframe, and indicators — then start capturing evidence.",
  },
  {
    href: "/team",
    title: "Invite teammates",
    description: "Add colleagues with the right roles so field staff and approvers can work together.",
  },
  {
    href: "/settings/billing",
    title: "Manage your subscription",
    description: "View your plan, switch between monthly and annual billing, or manage payment details.",
  },
];

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
    <main className="mx-auto mt-24 max-w-2xl animate-fade-in px-6">
      <div className="card space-y-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/15">
          <svg viewBox="0 0 24 24" className="h-9 w-9 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Thank you — payment confirmed</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Your upgraded plan is active and your workspace is ready. Complete a few quick setup steps below to get
            your team reporting in minutes.
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
        </div>

        {!signatureOk && apiKey && (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Payment confirmation is processed automatically and may take a minute to appear in your workspace.
          </p>
        )}
      </div>

      <section className="mt-8" aria-labelledby="quick-start">
        <h2 id="quick-start" className="text-center text-lg font-bold text-slate-800 dark:text-slate-100">
          Quick start
        </h2>
        <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
          Pick up right where you left off.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {QUICK_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="card group space-y-1.5 p-5 transition hover:border-brand-400/40 hover:bg-brand-500/5">
              <span className="block font-semibold text-slate-800 group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-brand-300">
                {link.title} →
              </span>
              <span className="block text-sm text-slate-500 dark:text-slate-400">{link.description}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
