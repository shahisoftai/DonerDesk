import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SupportJsonLd } from "@/components/support/SupportJsonLd";
import { WikiTopNav, CategoryNav } from "@/components/support/CategoryNav";
import { WIKI_CATEGORIES } from "@/components/support/wikiCategories";
import { loadArticle } from "@/components/support/wikiUtils";

/** Class names are written out in full so Tailwind sees every one of them. */
const ACCENTS = {
  saffron: {
    lead: "border-saffron/40",
    link: "text-saffron hover:text-saffron",
    code: "text-saffron",
    quote: "border-saffron/40",
  },
  seafoam: {
    lead: "border-seafoam/40",
    link: "text-seafoam hover:text-seafoam",
    code: "text-seafoam",
    quote: "border-seafoam/40",
  },
  skyline: {
    lead: "border-skyline/40",
    link: "text-skyline hover:text-skyline",
    code: "text-skyline",
    quote: "border-skyline/40",
  },
  coral: {
    lead: "border-coral/40",
    link: "text-coral hover:text-coral",
    code: "text-coral",
    quote: "border-coral/40",
  },
} as const;

export type SupportAccent = keyof typeof ACCENTS;

export interface CategoryArticleProps {
  /** The category's URL segment and `WIKI_CATEGORIES` slug. */
  categorySlug: string;
  /** Category name shown in the breadcrumb and the back link. */
  categoryLabel: string;
  accent: SupportAccent;
  /** The article's URL segment. */
  article: string;
  /** Path of the markdown file under the support content folder, or undefined when the slug is unknown. */
  relPath: string | undefined;
}

/** One article page for every support category; each category supplies only its own facts. */
export function CategoryArticle({ categorySlug, categoryLabel, accent, article, relPath }: CategoryArticleProps) {
  if (!relPath) notFound();

  const loaded = loadArticle(relPath);
  if (!loaded) notFound();

  const cat = WIKI_CATEGORIES.find((c) => c.slug === categorySlug);
  const artEntry = cat?.articles.find((a) => a.href === `/support/${categorySlug}/${article}`);
  const title = artEntry?.title ?? loaded.title;
  const tone = ACCENTS[accent];

  return (
    <div className="min-h-screen overflow-x-hidden bg-spruce text-paper">
      <SupportJsonLd categorySlug={categorySlug} article={article} title={title} />
      <WikiTopNav />
      <div className="border-b border-white/5 bg-spruce/50 px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-1.5 text-xs text-mist">
          <Link href="/support">Support Center</Link>
          <span>›</span>
          <Link href={`/support/${categorySlug}`}>{categoryLabel}</Link>
          <span>›</span>
          <span className="text-paper">{title}</span>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl gap-0 px-6 py-8">
        <aside className="hidden w-64 flex-shrink-0 lg:block">
          <CategoryNav categories={WIKI_CATEGORIES} />
        </aside>
        <main className="min-w-0 flex-1 lg:px-8">
          <article className="prose prose-invert max-w-none">
            <h1 className="text-3xl font-extrabold text-white mb-2">{title}</h1>
            {artEntry?.description && (
              <p className={`text-mist text-sm mb-6 border-l-2 ${tone.lead} pl-3`}>{artEntry.description}</p>
            )}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: ({ children }) => <h2 className="text-xl font-bold text-white mt-8 mb-3 border-b border-white/10 pb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-lg font-semibold text-paper mt-6 mb-2">{children}</h3>,
                  p: ({ children }) => <p className="text-mist leading-relaxed mb-4">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside text-mist space-y-1 mb-4">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside text-mist space-y-1 mb-4">{children}</ol>,
                  li: ({ children }) => <li className="text-mist">{children}</li>,
                  a: ({ href, children }) => <a href={href} className={`${tone.link} underline`} target="_blank" rel="noopener">{children}</a>,
                  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                  code: ({ children }) => <code className={`bg-white/5 ${tone.code} px-1.5 py-0.5 rounded text-sm`}>{children}</code>,
                  blockquote: ({ children }) => <blockquote className={`border-l-4 ${tone.quote} pl-4 italic text-mist my-4`}>{children}</blockquote>,
                  hr: () => <hr className="border-white/10 my-6" />,
                  table: ({ children }) => <table className="w-full border-collapse border border-white/10 text-sm my-4">{children}</table>,
                  th: ({ children }) => <th className="border border-white/10 bg-white/5 px-3 py-2 text-left text-paper font-semibold">{children}</th>,
                  td: ({ children }) => <td className="border border-white/10 px-3 py-2 text-mist">{children}</td>,
                }}
              >
                {loaded.content}
              </ReactMarkdown>
            </div>
            <div className="mt-8 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div />
              <Link href={`/support/${categorySlug}`} className={`text-sm ${tone.link} transition`}>
                {`← Back to ${categoryLabel}`}
              </Link>
              <div />
            </div>
          </article>
        </main>
      </div>
      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <p className="text-sm text-fog">© {new Date().getFullYear()} DonorDesk. All rights reserved.</p>
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
