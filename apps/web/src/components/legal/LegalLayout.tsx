import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

export type TocItem = { id: string; title: string };

export function LegalLayout({
  title,
  subtitle,
  updated,
  toc,
  children,
}: {
  title: string;
  subtitle: string;
  updated: string;
  toc: TocItem[];
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0b1220] text-slate-100">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0f1b3d]/85 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center">
            <Image
              src="/brand/donordesk-logo.png"
              alt="DonorDesk"
              width={552}
              height={600}
              className="h-9 w-auto object-contain"
            />
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-slate-300 transition hover:text-white"
          >
            ← Back to home
          </Link>
        </nav>
      </header>

      {/* Version 4.000 (plan F92): a readable column with the contents kept in view beside it on wide screens. */}
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-14 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
        <nav aria-label="Table of contents" className="mb-10 lg:sticky lg:top-24 lg:mb-0 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">On this page</p>
          <ol className="mt-3 space-y-0.5 border-s border-white/10 text-sm">
            {toc.map((item, i) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="-ms-px flex gap-2 border-s border-transparent py-1.5 ps-3 text-slate-400 transition hover:border-brand-300 hover:text-white">
                  <span className="font-mono text-xs text-slate-500">{String(i + 1).padStart(2, "0")}</span>
                  {item.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="min-w-0 max-w-[72ch]">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-teal-300">{subtitle}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.02em] text-white sm:text-5xl">{title}</h1>
          <p className="mt-3 text-sm text-slate-400">
            Effective date: <span className="font-semibold text-slate-300">{updated}</span> · Applies to the Service at{" "}
            <span className="text-brand-300">donordesk.online</span>
          </p>
          <div className="mt-12 space-y-12">{children}</div>
        </article>
      </div>

      <footer className="border-t border-white/10 px-6 py-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-4 text-sm text-slate-400 sm:flex-row">
          <Image
            src="/brand/donordesk-logo.png"
            alt="DonorDesk"
            width={552}
            height={600}
            className="h-9 w-auto object-contain"
          />
          <p>© {new Date().getFullYear()} DonorDesk. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="transition hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="transition hover:text-white">Terms of Service</Link>
            <Link href="/refunds" className="transition hover:text-white">Refund &amp; Cancellation Policy</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
