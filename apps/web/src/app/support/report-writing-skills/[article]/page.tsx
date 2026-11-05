import type { Metadata } from "next";
import { supportArticleMetadata } from "@/lib/seo";
import { CategoryArticle } from "@/components/support/CategoryArticle";

const FILE_MAP: Record<string, string> = {
  "report-writing-fundamentals": "report-writing-skills/fundamentals/report-writing-fundamentals.md",
  "indicators-evidence": "report-writing-skills/fundamentals/indicators-evidence.md",
  "writing-clearly": "report-writing-skills/fundamentals/writing-clearly.md",
  "narrative-structure": "report-writing-skills/fundamentals/narrative-structure.md",
  "unhcr-reporting": "report-writing-skills/donor-specific/unhcr-reporting.md",
  "dg-echo": "report-writing-skills/donor-specific/dg-echo.md",
  "usaid-reporting": "report-writing-skills/donor-specific/usaid-reporting.md",
  "global-fund": "report-writing-skills/donor-specific/global-fund.md",
  "gcf-reporting": "report-writing-skills/donor-specific/gcf-reporting.md",
  "fcdo-bilateral": "report-writing-skills/donor-specific/fcdo-bilateral.md",
  "eu-grants": "report-writing-skills/donor-specific/eu-grants.md",
  "gates-foundation": "report-writing-skills/donor-specific/gates-foundation.md",
  "pre-report-checklist": "report-writing-skills/tools/pre-report-checklist.md",
  "donor-comparison": "report-writing-skills/tools/donor-comparison.md",
  "evidence-inventory": "report-writing-skills/tools/evidence-inventory.md",
  "glossary": "report-writing-skills/tools/glossary.md",
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
  return supportArticleMetadata("report-writing-skills", article);
}

export default async function ReportWritingSkillsArticlePage({
  params,
}: {
  params: Promise<{ article: string }>;
}) {
  const { article } = await params;
  return (
    <CategoryArticle
      categorySlug="report-writing-skills"
      categoryLabel="Report Writing Skills"
      accent="saffron"
      article={article}
      relPath={FILE_MAP[article]}
    />
  );
}
