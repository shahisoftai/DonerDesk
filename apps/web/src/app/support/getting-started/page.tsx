import { supportCategoryMetadata } from "@/lib/seo";
import Link from "next/link";
import { WikiTopNav, CategoryNav } from "@/components/support/CategoryNav";
import { WIKI_CATEGORIES } from "@/components/support/wikiCategories";

const BREADCRUMBS = [{ label: "Getting Started", href: "/support/getting-started" }];

export const metadata = supportCategoryMetadata("getting-started");

export default function GettingStartedPage() {
  const cat = WIKI_CATEGORIES[0]!;
  const accentMap: Record<string, string> = {
    brand: "from-saffron/20 to-skyline/10 border-saffron/30",
    cyan: "from-skyline/20 to-skyline/10 border-skyline/30",
    rose: "from-coral/20 to-coral/10 border-coral/30",
    violet: "from-skyline/20 to-skyline/10 border-skyline/30",
    emerald: "from-seafoam/20 to-seafoam/10 border-seafoam/30",
    amber: "from-saffron/20 to-coral/10 border-saffron/30",
  };
  const accent = accentMap[cat.accentColor] ?? accentMap.brand;

  return (
    <div className="min-h-screen overflow-x-hidden bg-spruce text-paper">
      <WikiTopNav />
      {/* Breadcrumbs */}
      <div className="border-b border-white/5 bg-spruce/50 px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-1.5 text-xs text-mist">
          <Link href="/support">Support Center</Link>
          <span>›</span>
          <span className="text-paper">Getting Started</span>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl gap-0 px-6 py-8">
        <aside className="hidden w-64 flex-shrink-0 lg:block">
          <CategoryNav categories={WIKI_CATEGORIES} />
        </aside>
        <main className="min-w-0 flex-1 lg:px-8">
          {/* Category header */}
          <div className="mb-8">
            <div className={`inline-flex rounded-xl border bg-gradient-to-br ${accent} px-4 py-2`}>
              <span className="text-saffron">{cat.icon}</span>
              <span className="ml-2 text-sm font-semibold text-white">{cat.name}</span>
            </div>
            <h1 className="mt-4 text-3xl font-extrabold text-white">Getting Started with DonorDesk</h1>
            <p className="mt-2 max-w-2xl text-mist">{cat.description}</p>
          </div>
          {/* Articles grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {cat.articles.map((art) => (
              <Link
                key={art.href}
                href={art.href}
                className="group rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:-translate-y-0.5 hover:border-saffron/30 hover:bg-white/[0.05]"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-white group-hover:text-saffron">{art.title}</h3>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 flex-shrink-0 text-fog transition group-hover:translate-x-0.5 group-hover:text-saffron">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-mist">{art.description}</p>
              </Link>
            ))}
          </div>
        </main>
      </div>
      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <p className="text-sm text-fog">© {new Date().getFullYear()} DonorDesk. All rights reserved.</p>
          <div className="flex gap-6 text-sm text-fog">
            <Link href="/support" className="transition hover:text-mist">Support</Link>
            <Link href="/privacy" className="transition hover:text-mist">Privacy</Link>
            <Link href="/terms" className="transition hover:text-mist">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
