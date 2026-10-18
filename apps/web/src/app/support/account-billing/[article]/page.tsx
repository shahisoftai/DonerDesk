import type { Metadata } from "next";
import { supportArticleMetadata } from "@/lib/seo";
import { SupportJsonLd } from "@/components/support/SupportJsonLd";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { WikiTopNav, CategoryNav } from "@/components/support/CategoryNav";
import { WIKI_CATEGORIES } from "@/components/support/wikiCategories";
import { loadArticle } from "@/components/support/wikiUtils";

const FILE_MAP: Record<string, string> = {
  "invoices": "account-billing-invoices.md",
  "plans-and-limits": "account-billing-plans-and-limits.md",
};

export async function generateStaticParams() {
  return Object.keys(FILE_MAP).map((slug) => ({ article: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ article: string }>;
}): Promise<Metadata> {
  const { article } = await params;
  return supportArticleMetadata("account-billing", article);
}

export default async function AccountBillingArticlePage({
  params,
}: {
  params: Promise<{ article: string }>;
}) {
  const { article } = await params;
  const relPath = FILE_MAP[article];
  if (!relPath) notFound();

  const article_ = loadArticle(relPath);
  if (!article_) notFound();

  const cat = WIKI_CATEGORIES[4]!;
  const artEntry = cat.articles.find((a) => a.href === `/support/account-billing/${article}`);
  const title = artEntry?.title ?? article_.title;

  return (
    <div className="min-h-screen overflow-x-hidden bg-spruce text-paper">
      <SupportJsonLd categorySlug="account-billing" article={article} title={title} />
      <WikiTopNav />
      <div className="border-b border-white/5 bg-spruce/50 px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-1.5 text-xs text-mist">
          <Link href="/support">Support Center</Link>
          <span>›</span>
          <Link href="/support/account-billing">Account & Billing</Link>
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
              <p className="text-mist text-sm mb-6 border-l-2 border-seafoam/40 pl-3">
                {artEntry.description}
              </p>
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
                  a: ({ href, children }) => <a href={href} className="text-seafoam hover:text-seafoam underline" target="_blank" rel="noopener">{children}</a>,
                  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                  code: ({ children }) => <code className="bg-white/5 text-seafoam px-1.5 py-0.5 rounded text-sm">{children}</code>,
                  blockquote: ({ children }) => <blockquote className="border-l-4 border-seafoam/40 pl-4 italic text-mist my-4">{children}</blockquote>,
                  hr: () => <hr className="border-white/10 my-6" />,
                  table: ({ children }) => <table className="w-full border-collapse border border-white/10 text-sm my-4">{children}</table>,
                  th: ({ children }) => <th className="border border-white/10 bg-white/5 px-3 py-2 text-left text-paper font-semibold">{children}</th>,
                  td: ({ children }) => <td className="border border-white/10 px-3 py-2 text-mist">{children}</td>,
                }}
              >
                {article_.content}
              </ReactMarkdown>
            </div>
            <div className="mt-8 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div />
              <Link href="/support/account-billing" className="text-sm text-seafoam hover:text-seafoam transition">
                ← Back to Account & Billing
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
          </div>
        </div>
      </footer>
    </div>
  );
}
