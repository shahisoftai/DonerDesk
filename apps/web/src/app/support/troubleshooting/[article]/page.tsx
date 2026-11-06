import type { Metadata } from "next";
import { supportArticleMetadata } from "@/lib/seo";
import { CategoryArticle } from "@/components/support/CategoryArticle";

const FILE_MAP: Record<string, string> = {
  "login-issues": "troubleshooting-login-issues.md",
  "account-access": "troubleshooting-account-access.md",
  "billing-issues": "troubleshooting-billing-issues.md",
  "browser-performance": "troubleshooting-browser-performance.md",
  "data-recovery": "troubleshooting-data-recovery.md",
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ article: string }>;
}): Promise<Metadata> {
  const { article } = await params;
  return supportArticleMetadata("troubleshooting", article);
}

export default async function TroubleshootingArticlePage({
  params,
}: {
  params: Promise<{ article: string }>;
}) {
  const { article } = await params;
  return (
    <CategoryArticle
      categorySlug="troubleshooting"
      categoryLabel="Troubleshooting"
      accent="coral"
      article={article}
      relPath={FILE_MAP[article]}
    />
  );
}
