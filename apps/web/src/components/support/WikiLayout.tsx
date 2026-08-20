import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

export interface WikiArticle {
  title: string;
  description: string;
  href: string;
  badge?: string;
}

export interface WikiCategory {
  name: string;
  slug: string;
  icon: ReactNode;
  description: string;
  accentColor: string;
  articles: WikiArticle[];
}

const SUPPORT_HOMEBREAD = { label: "Support Center", href: "/support" };

function ChevronRight() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-600">
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7A1 1 0 003 11h1v6a1 1 0 001 1h4a1 1 0 001-1v-5h2a1 1 0 001-1v4a1 1 0 001 1h4a1 1 0 001-1v-6h1a1 1 0 00.707-1.707l-7-7z" />
    </svg>
  );
}

export function WikiLayout({
  children,
  categories,
  currentPath,
  breadcrumbs = [],
}: {
  children: ReactNode;
  categories: WikiCategory[];
  currentPath: string;
  breadcrumbs?: { label: string; href: string }[];
}) {
  const allBreadcrumbs = [SUPPORT_HOMEBREAD, ...breadcrumbs];

  return (
    <div className="landing-tech min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      {/* Top Nav */}
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
            <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-slate-200 transition hover:text-white">
              Log in
            </Link>
            <Link href="/support/contact" className="rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-brand-500/30 transition hover:from-brand-400 hover:to-brand-500">
              Submit a ticket
            </Link>
          </div>
        </nav>
      </header>

      {/* Breadcrumbs */}
      <div className="border-b border-white/5 bg-slate-950/50 px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-1.5 text-xs text-slate-400">
          <Link href="/support" className="flex items-center gap-1.5 transition hover:text-slate-200">
            <HomeIcon />
            Support Center
          </Link>
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <ChevronRight />
              <Link href={b.href} className="transition hover:text-slate-200">{b.label}</Link>
            </span>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto flex max-w-7xl gap-0 px-6 py-8">
        {/* Left Sidebar — Categories + Articles */}
        <aside className="hidden w-64 flex-shrink-0 lg:block">
          <nav className="sticky top-28 space-y-6">
            {categories.map((cat) => {
              const isActive = currentPath.startsWith(`/support/${cat.slug}`);
              return (
                <div key={cat.slug}>
                  <Link
                    href={`/support/${cat.slug}`}
                    className={`flex items-center gap-2.5 text-sm font-medium transition ${
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
                        const isArtActive = currentPath === art.href;
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
        </aside>

        {/* Main Content */}
        <main className="min-w-0 flex-1 lg:px-8">
          {children}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} DonorDesk. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link href="/support" className="transition hover:text-slate-300">Support</Link>
            <Link href="/privacy" className="transition hover:text-slate-300">Privacy</Link>
            <Link href="/terms" className="transition hover:text-slate-300">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
