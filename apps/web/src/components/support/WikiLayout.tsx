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
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-fog">
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
    <div className="min-h-screen overflow-x-hidden bg-spruce text-paper">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-spruce/85 shadow-[0_10px_40px_rgba(2,6,23,0.35)] backdrop-blur-2xl supports-[backdrop-filter]:bg-spruce/70">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center">
            <Image src="/brand/donordesk-logo.png" alt="DonorDesk" width={552} height={600} className="h-9 w-auto object-contain" />
          </Link>
          <div className="hidden items-center gap-7 text-sm font-medium text-mist lg:flex">
            <Link href="/" className="transition hover:text-white">Home</Link>
            <Link href="/pricing" className="transition hover:text-white">Pricing</Link>
            <Link href="/support" className="transition hover:text-white text-saffron">Support</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-paper transition hover:text-white">
              Log in
            </Link>
            <Link href="/support/contact" className="rounded-lg bg-gradient-to-r from-saffron to-saffron px-4 py-2 text-sm font-medium text-spruce shadow-lg shadow-saffron/30 transition hover:from-saffron hover:to-saffron">
              Submit a ticket
            </Link>
          </div>
        </nav>
      </header>

      {/* Breadcrumbs */}
      <div className="border-b border-white/5 bg-spruce/50 px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-1.5 text-xs text-mist">
          <Link href="/support" className="flex items-center gap-1.5 transition hover:text-paper">
            <HomeIcon />
            Support Center
          </Link>
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <ChevronRight />
              <Link href={b.href} className="transition hover:text-paper">{b.label}</Link>
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
                      isActive ? "text-saffron" : "text-paper hover:text-white"
                    }`}
                  >
                    <span className={`rounded-lg p-1 ${isActive ? "bg-saffron/20 text-saffron" : "bg-white/5 text-mist"}`}>
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
                                  ? "border-l-2 border-saffron bg-saffron/10 pl-[6px] text-saffron"
                                  : "text-mist hover:text-paper"
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
          <p className="text-sm text-fog">
            © {new Date().getFullYear()} DonorDesk. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-fog">
            <Link href="/support" className="transition hover:text-mist">Support</Link>
            <Link href="/privacy" className="transition hover:text-mist">Privacy</Link>
            <Link href="/terms" className="transition hover:text-mist">Terms</Link>
            <Link href="/refunds" className="transition hover:text-mist">Refunds</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
