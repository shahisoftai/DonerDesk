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
    <main className="min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center">
            <Image
              src="/brand/donordesk-logo.png"
              alt="DonorDesk"
              width={1653}
              height={589}
              className="h-9 w-auto object-contain"
            />
          </Link>
          <Link
            href="/"
            className="text-sm font-semibold text-slate-300 transition hover:text-white"
          >
            ← Back to home
          </Link>
        </nav>
      </header>

      <div className="mx-auto max-w-3xl px-6 pb-16 pt-14">
        <p className="text-sm font-bold uppercase tracking-widest text-brand-300">
          {subtitle}
        </p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          Effective date: <span className="font-semibold text-slate-300">{updated}</span> · Applies to the Service at{" "}
          <span className="text-brand-300">donordesk.online</span>
        </p>

        <nav
          aria-label="Table of contents"
          className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            On this page
          </p>
          <ol className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {toc.map((item, i) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="inline-flex items-start gap-2 rounded-lg px-2 py-1 text-slate-300 transition hover:bg-white/5 hover:text-white"
                >
                  <span className="font-mono text-xs text-brand-400">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {item.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 space-y-12">{children}</div>
      </div>

      <footer className="border-t border-white/10 px-6 py-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-4 text-sm text-slate-400 sm:flex-row">
          <Image
            src="/brand/donordesk-logo.png"
            alt="DonorDesk"
            width={1653}
            height={589}
            className="h-9 w-auto object-contain"
          />
          <p>© {new Date().getFullYear()} DonorDesk. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="transition hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="transition hover:text-white">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
