import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";

const POINTS = [
  "Logframe, work plan, field data and evidence in one place",
  "Every figure in a report checked against its source",
  "Works offline in the field, in four languages",
];

/**
 * Sign-in, sign-up, password and invitation pages (Version 4.000, plan F91): the form on one side, the navy brand panel on
 * the other (hidden on phones, where the form fills the screen).
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-[var(--background)] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex min-w-0 flex-col px-4 py-8 sm:px-10">
        <Link href="/" className="inline-flex items-center gap-2 self-start rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          <Image src="/brand/donordesk-logo.png" alt="" width={552} height={600} className="h-8 w-auto" />
          <span className="text-base font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">DonorDesk</span>
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">{children}</div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <Link className="hover:underline" href="/privacy">Privacy</Link> · <Link className="hover:underline" href="/terms">Terms</Link> · <Link className="hover:underline" href="/security">Security</Link>
        </p>
      </div>
      <aside className="relative hidden overflow-hidden bg-[#0f1b3d] text-white lg:flex lg:flex-col lg:justify-center lg:px-14">
        <div aria-hidden="true" className="absolute -end-24 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgba(59,99,235,0.45),transparent)]" />
        <div aria-hidden="true" className="absolute -bottom-28 -start-20 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgba(13,148,136,0.35),transparent)]" />
        <p className="relative font-mono text-xs uppercase tracking-[0.12em] text-teal-300">Programme management for NGOs</p>
        <p className="relative mt-4 max-w-md text-3xl font-semibold leading-tight tracking-[-0.02em] [text-wrap:balance]">Plan the work, prove the results, report to every donor.</p>
        <ul className="relative mt-8 space-y-3 text-[15px] text-slate-200">
          {POINTS.map((p) => (
            <li key={p} className="flex items-start gap-3"><CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" />{p}</li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
