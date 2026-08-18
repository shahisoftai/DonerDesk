"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { WikiCategory } from "./WikiLayout";

export function CategoryNav({ categories }: { categories: WikiCategory[] }) {
  const pathname = usePathname();

  return (
    <nav className="sticky top-28 space-y-6">
      {categories.map((cat) => {
        const isActive = pathname.startsWith(`/support/${cat.slug}`);
        return (
          <div key={cat.slug}>
            <Link
              href={`/support/${cat.slug}`}
              className={`flex items-center gap-2.5 text-sm font-semibold transition ${
                isActive ? "text-brand-300" : "text-slate-200 hover:text-white"
              }`}
            >
              <span className={`rounded-lg p-1 ${isActive ? "bg-brand-500/20 text-brand-300" : "bg-white/5 text-slate-400"}`}>
                {cat.icon}
              </span>
              {cat.name}
            </Link>
            {isActive && (
              <ul className="ml-9 mt-2 space-y-1 border-l border-white/10 pl-3">
                {cat.articles.map((art) => {
                  const isArtActive = pathname === art.href;
                  return (
                    <li key={art.href}>
                      <Link
                        href={art.href}
                        className={`block rounded-md px-2 py-1.5 text-xs leading-relaxed transition ${
                          isArtActive
                            ? "border-l-2 border-brand-400 bg-brand-500/10 pl-[6px] text-brand-300"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {art.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function WikiTopNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/85 shadow-[0_10px_40px_rgba(2,6,23,0.35)] backdrop-blur-2xl supports-[backdrop-filter]:bg-slate-950/70">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center">
          <Image src="/brand/donordesk-logo.png" alt="DonorDesk" width={1653} height={589} className="h-9 w-auto object-contain" />
        </Link>
        <div className="hidden items-center gap-7 text-sm font-medium text-slate-300 lg:flex">
          <Link href="/" className="transition hover:text-white">Home</Link>
          <Link href="/pricing" className="transition hover:text-white">Pricing</Link>
          <Link href="/support" className="transition hover:text-white text-brand-300">Support</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-200 transition hover:text-white">
            Log in
          </Link>
          <Link href="/support/contact" className="rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition hover:from-brand-400 hover:to-brand-500">
            Submit a ticket
          </Link>
        </div>
      </nav>
    </header>
  );
}
