import Link from "next/link";
import { WikiTopNav, CategoryNav } from "@/components/support/CategoryNav";
import { WIKI_CATEGORIES } from "@/components/support/wikiCategories";

export default function ReportWritingSkillsPage() {
  const cat = WIKI_CATEGORIES.find((c) => c.slug === "report-writing-skills")!;
  const accentMap: Record<string, string> = {
    brand: "from-brand-500/20 to-cyan-500/10 border-brand-400/30",
    cyan: "from-cyan-500/20 to-blue-500/10 border-cyan-400/30",
    rose: "from-rose-500/20 to-pink-500/10 border-rose-400/30",
    violet: "from-violet-500/20 to-purple-500/10 border-violet-400/30",
    emerald: "from-emerald-500/20 to-teal-500/10 border-emerald-400/30",
    amber: "from-amber-500/20 to-orange-500/10 border-amber-400/30",
    blue: "from-blue-500/20 to-indigo-500/10 border-blue-400/30",
  };
  const accent = accentMap[cat.accentColor] ?? accentMap.brand;

  return (
    <div className="landing-tech min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <WikiTopNav />
      <div className="border-b border-white/5 bg-slate-950/50 px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-1.5 text-xs text-slate-400">
          <Link href="/support">Support Center</Link>
          <span>›</span>
          <span className="text-slate-200">Report Writing Skills</span>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl gap-0 px-6 py-8">
        <aside className="hidden w-64 flex-shrink-0 lg:block">
          <CategoryNav categories={WIKI_CATEGORIES} />
        </aside>
        <main className="min-w-0 flex-1 lg:px-8">
          <div className="mb-8">
            <div className={`inline-flex rounded-xl border bg-gradient-to-br ${accent} px-4 py-2`}>
              <span className="text-brand-300">{cat.icon}</span>
              <span className="ml-2 text-sm font-semibold text-white">{cat.name}</span>
            </div>
            <h1 className="mt-4 text-3xl font-extrabold text-white">Report Writing Skills</h1>
            <p className="mt-2 max-w-2xl text-slate-300">{cat.description}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {cat.articles.map((art) => (
              <Link
                key={art.href}
                href={art.href}
                className="group rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:-translate-y-0.5 hover:border-brand-400/30 hover:bg-white/[0.05]"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-white group-hover:text-brand-300">{art.title}</h3>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-brand-400">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 011.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{art.description}</p>
              </Link>
            ))}
          </div>
        </main>
      </div>
      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <p className="text-sm text-slate-500">© {new Date().getFullYear()} DonorDesk. All rights reserved.</p>
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
