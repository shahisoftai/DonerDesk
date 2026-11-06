import type { Metadata } from "next";
import { supportArticleMetadata } from "@/lib/seo";
import { CategoryArticle } from "@/components/support/CategoryArticle";

const FILE_MAP: Record<string, string> = {
  "what-is-donordesk": "basic-information/what-is-donordesk.md",
  "key-concepts": "basic-information/key-concepts.md",
  "understanding-projects": "basic-information/understanding-projects.md",
  "understanding-logframes": "basic-information/understanding-logframes.md",
  "indicators-and-targets": "basic-information-indicators-and-targets.md",
  "understanding-activities": "basic-information-understanding-activities.md",
  "understanding-evidence": "basic-information/understanding-evidence.md",
  "understanding-reporting-periods": "basic-information/understanding-reporting-periods.md",
  "understanding-compliance-checklist": "basic-information/understanding-compliance-checklist.md",
  "report-sections": "basic-information-report-sections.md",
  "report-statuses": "basic-information-report-statuses.md",
  "report-readiness": "basic-information-report-readiness.md",
  "reporting-workflow": "basic-information-reporting-workflow.md",
  "understanding-audit-logs": "basic-information/understanding-audit-logs.md",
  "donor-templates": "basic-information-donor-templates.md",
  "evidence-verification": "basic-information-evidence-verification.md",
  "logframe-hierarchy": "basic-information-logframe-hierarchy.md",
  "storage-file-management": "basic-information-storage-file-management.md",
  "ai-in-donordesk": "basic-information/ai-in-donordesk.md",
  "data-security": "basic-information/data-security.md",
  "user-roles-and-permissions": "basic-information/user-roles-and-permissions.md",
  "donor-desk-pricing-plans": "basic-information/donor-desk-pricing-plans.md",
  "getting-started": "basic-information/getting-started-overview.md",
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
  return supportArticleMetadata("getting-started", article);
}

export default async function GettingStartedArticlePage({
  params,
}: {
  params: Promise<{ article: string }>;
}) {
  const { article } = await params;
  return (
    <CategoryArticle
      categorySlug="getting-started"
      categoryLabel="Getting Started"
      accent="saffron"
      article={article}
      relPath={FILE_MAP[article]}
    />
  );
}
