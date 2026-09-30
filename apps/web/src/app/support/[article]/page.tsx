import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { WikiTopNav, CategoryNav } from "@/components/support/CategoryNav";
import { WIKI_CATEGORIES } from "@/components/support/wikiCategories";
import { loadArticle } from "@/components/support/wikiUtils";

const FILE_MAP: Record<string, { file: string; title: string }> = {
  contact: { file: "support-contact.md", title: "Contact Support" },
  "reference-faq": { file: "reference-faq.md", title: "Frequently Asked Questions" },
  "reference-glossary": { file: "reference-glossary.md", title: "Glossary" },
  "reference-file-formats": { file: "reference-file-formats.md", title: "Supported File Formats and Size Limits" },
  "reference-error-codes": { file: "reference-error-codes.md", title: "Common Messages and What to Do" },
  "reference-keyboard-shortcuts": { file: "reference-keyboard-shortcuts.md", title: "Keyboard Shortcuts" },
  "reference-donor-reporting-guidelines": { file: "reference-donor-reporting-guidelines.md", title: "Donor Reporting Guidelines Index" },
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
  const entry = FILE_MAP[article];
  if (!entry) return {};
  return {
    title: `${entry.title} — Support Center`,
    alternates: { canonical: `/support/${article}` },
  };
}

export default async function SupportReferencePage({
  params,
}: {
  params: Promise<{ article: string }>;
}) {
  const { article } = await params;
  const entry = FILE_MAP[article];
  if (!entry) notFound();

  const article_ = loadArticle(entry.file);
  if (!article_) notFound();

  const title = entry.title;

  return (
    <div className="landing-tech min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <WikiTopNav />
      <div className="border-b border-white/5 bg-slate-950/50 px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-1.5 text-xs text-slate-400">
          <Link href="/support">Support Center</Link>
          <span>›</span>
          <span className="text-slate-200">{title}</span>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl gap-0 px-6 py-8">
        <aside className="hidden w-64 flex-shrink-0 lg:block">
          <CategoryNav categories={WIKI_CATEGORIES} />
        </aside>
        <main className="min-w-0 flex-1 lg:px-8">
          <article className="prose prose-invert prose-slate max-w-none">
            <h1 className="text-3xl font-extrabold text-white mb-2">{title}</h1>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: ({ children }) => <h2 className="text-xl font-bold text-white mt-8 mb-3 border-b border-white/10 pb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-lg font-semibold text-slate-200 mt-6 mb-2">{children}</h3>,
                  p: ({ children }) => <p className="text-slate-300 leading-relaxed mb-4">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside text-slate-300 space-y-1 mb-4">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside text-slate-300 space-y-1 mb-4">{children}</ol>,
                  li: ({ children }) => <li className="text-slate-300">{children}</li>,
                  a: ({ href, children }) => <a href={href} className="text-amber-400 hover:text-amber-300 underline" target="_blank" rel="noopener">{children}</a>,
                  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                  code: ({ children }) => <code className="bg-white/5 text-amber-300 px-1.5 py-0.5 rounded text-sm">{children}</code>,
                  blockquote: ({ children }) => <blockquote className="border-l-4 border-amber-500/40 pl-4 italic text-slate-400 my-4">{children}</blockquote>,
                  hr: () => <hr className="border-white/10 my-6" />,
                  table: ({ children }) => <table className="w-full border-collapse border border-white/10 text-sm my-4">{children}</table>,
                  th: ({ children }) => <th className="border border-white/10 bg-white/5 px-3 py-2 text-left text-slate-200 font-semibold">{children}</th>,
                  td: ({ children }) => <td className="border border-white/10 px-3 py-2 text-slate-300">{children}</td>,
                }}
              >
                {article_.content}
              </ReactMarkdown>
            </div>
            <div className="mt-8 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div />
              <Link href="/support" className="text-sm text-amber-400 hover:text-amber-300 transition">
                ← Back to Support Center
              </Link>
              <div />
            </div>
          </article>
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
