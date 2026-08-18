import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { WikiTopNav, CategoryNav } from "@/components/support/CategoryNav";
import { WIKI_CATEGORIES } from "@/components/support/wikiCategories";
import { loadArticle } from "@/components/support/wikiUtils";

const FILE_MAP: Record<string, string> = {
  "log-in": "how-to/how-to-log-in.md",
  "create-an-account": "how-to/how-to-create-an-account.md",
  "change-your-password": "how-to/how-to-change-your-password.md",
  "delete-your-account": "how-to/how-to-delete-your-account.md",
  "set-up-new-organisation": "how-to-set-up-new-organisation.md",
  "create-a-project": "how-to/how-to-create-a-project.md",
  "build-logframe": "how-to/how-to-build-logframe.md",
  "upload-donor-template": "how-to/how-to-upload-donor-template.md",
  "update-indicator-values": "how-to/how-to-update-indicator-values.md",
  "log-activities": "how-to/how-to-log-activities.md",
  "upload-evidence": "how-to/how-to-upload-evidence.md",
  "use-the-dashboard": "how-to/how-to-use-the-dashboard.md",
  "use-tags-and-filters": "how-to/how-to-use-tags-and-filters.md",
  "search-projects-and-evidence": "how-to/how-to-search-projects-and-evidence.md",
  "invite-team-members": "how-to/how-to-invite-team-members.md",
  "manage-team-roles-permissions": "how-to/how-to-manage-team-roles-permissions.md",
  "manage-billing-subscription": "how-to/how-to-manage-billing-subscription.md",
  "export-donor-data": "how-to/how-to-export-donor-data.md",
  "export-reports": "how-to/how-to-export-reports.md",
  "generate-ai-report-draft": "how-to/how-to-generate-ai-report-draft.md",
  "review-and-approve-reports": "how-to/how-to-review-and-approve-reports.md",
  "use-the-audit-trail": "how-to-use-the-audit-trail.md",
  "use-comments-feedback": "how-to-use-comments-feedback.md",
  "use-the-notification-system": "how-to/how-to-use-the-notification-system.md",
  "use-compliance-checklist": "how-to/how-to-use-compliance-checklist.md",
  "use-bulk-actions": "how-to/how-to-use-bulk-actions.md",
  "set-up-custom-fields": "how-to/how-to-set-up-custom-fields.md",
  "set-up-payment-integrations": "how-to/how-to-set-up-payment-integrations.md",
  "manage-recurring-donations": "how-to/how-to-manage-recurring-donations.md",
  "process-refunds": "how-to/how-to-process-refunds.md",
  "handle-failed-payments": "how-to/how-to-handle-failed-payments.md",
  "connect-google-drive": "how-to/how-to-connect-google-drive.md",
  "import-from-google-sheets": "how-to/how-to-import-from-google-sheets.md",
  "change-organisation-profile": "how-to/how-to-change-organisation-profile.md",
  "archive-a-project": "how-to/how-to-archive-a-project.md",
  "set-up-automated-receipts": "how-to/how-to-set-up-automated-receipts.md",
  "manage-donation-tiers": "how-to/how-to-manage-donation-tiers.md",
  "manage-currency-settings": "how-to/how-to-manage-currency-settings.md",
  "use-the-activity-feed": "how-to/how-to-use-the-activity-feed.md",
  "use-search-functionality": "how-to/how-to-use-search-functionality.md",
  "onboard-team-member": "how-to-onboard-team-member.md",
  "prepare-for-donor-visit": "how-to-prepare-for-donor-visit.md",
};

export async function generateStaticParams() {
  return Object.keys(FILE_MAP).map((slug) => ({ article: slug }));
}

export default async function HowToArticlePage({
  params,
}: {
  params: Promise<{ article: string }>;
}) {
  const { article } = await params;
  const relPath = FILE_MAP[article];
  if (!relPath) notFound();

  const article_ = loadArticle(relPath);
  if (!article_) notFound();

  const cat = WIKI_CATEGORIES[1]!;
  const artEntry = cat.articles.find((a) => a.href === `/support/how-to/${article}`);
  const title = artEntry?.title ?? article_.title;

  return (
    <div className="landing-tech min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <WikiTopNav />
      <div className="border-b border-white/5 bg-slate-950/50 px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-1.5 text-xs text-slate-400">
          <Link href="/support">Support Center</Link>
          <span>›</span>
          <Link href="/support/how-to">How-To Guides</Link>
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
              <p className="text-slate-400 text-sm mb-6 border-l-2 border-cyan-500/40 pl-3">
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
                  a: ({ href, children }) => <a href={href} className="text-cyan-400 hover:text-cyan-300 underline" target="_blank" rel="noopener">{children}</a>,
                  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                  code: ({ children }) => <code className="bg-white/5 text-cyan-300 px-1.5 py-0.5 rounded text-sm">{children}</code>,
                  blockquote: ({ children }) => <blockquote className="border-l-4 border-cyan-500/40 pl-4 italic text-slate-400 my-4">{children}</blockquote>,
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
              <Link href="/support/how-to" className="text-sm text-cyan-400 hover:text-cyan-300 transition">
                ← Back to How-To Guides
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
