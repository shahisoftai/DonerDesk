import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { WikiTopNav, CategoryNav } from "@/components/support/CategoryNav";
import { WIKI_CATEGORIES } from "@/components/support/wikiCategories";
import { loadArticle } from "@/components/support/wikiUtils";

const FILE_MAP: Record<string, string> = {
  "login-issues": "troubleshooting-login-issues.md",
  "account-access": "troubleshooting-account-access.md",
  "billing-issues": "troubleshooting-billing-issues.md",
  "browser-performance": "troubleshooting-browser-performance.md",
  "data-recovery": "troubleshooting-data-recovery.md",
  "email-delivery": "troubleshooting-email-delivery.md",
  "payment-issues": "troubleshooting-payment-issues.md",
  "project-setup": "troubleshooting-project-setup.md",
  "logframe-issues": "troubleshooting-logframe-issues.md",
  "indicator-data": "troubleshooting-indicator-data.md",
  "evidence-upload": "troubleshooting-evidence-upload.md",
  "report-generation": "troubleshooting-report-generation.md",
  "export-issues": "troubleshooting-export-issues.md",
  "storage-issues": "troubleshooting-storage-issues.md",
  "dashboard-loading": "troubleshooting-dashboard-loading.md",
  "compliance-checklist": "troubleshooting-compliance-checklist.md",
  "ai-report-generation": "troubleshooting-ai-report-generation.md",
};

export async function generateStaticParams() {
  return Object.keys(FILE_MAP).map((slug) => ({ article: slug }));
}

export default async function TroubleshootingArticlePage({
  params,
}: {
  params: Promise<{ article: string }>;
}) {
  const { article } = await params;
  const relPath = FILE_MAP[article];
  if (!relPath) notFound();

  const article_ = loadArticle(relPath);
  if (!article_) notFound();

  const cat = WIKI_CATEGORIES[2]!;
  const artEntry = cat.articles.find((a) => a.href === `/support/troubleshooting/${article}`);
  const title = artEntry?.title ?? article_.title;

  return (
    <div className="landing-tech min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <WikiTopNav />
      <div className="border-b border-white/5 bg-slate-950/50 px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-1.5 text-xs text-slate-400">
          <Link href="/support">Support Center</Link>
          <span>›</span>
          <Link href="/support/troubleshooting">Troubleshooting</Link>
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
            {artEntry?.description && (
              <p className="text-slate-400 text-sm mb-6 border-l-2 border-rose-500/40 pl-3">
                {artEntry.description}
              </p>
            )}
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
                  a: ({ href, children }) => <a href={href} className="text-rose-400 hover:text-rose-300 underline" target="_blank" rel="noopener">{children}</a>,
                  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                  code: ({ children }) => <code className="bg-white/5 text-rose-300 px-1.5 py-0.5 rounded text-sm">{children}</code>,
                  blockquote: ({ children }) => <blockquote className="border-l-4 border-rose-500/40 pl-4 italic text-slate-400 my-4">{children}</blockquote>,
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
              <Link href="/support/troubleshooting" className="text-sm text-rose-400 hover:text-rose-300 transition">
                ← Back to Troubleshooting
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
