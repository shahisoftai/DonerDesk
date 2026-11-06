import type { Metadata } from "next";
import { supportArticleMetadata } from "@/lib/seo";
import { CategoryArticle } from "@/components/support/CategoryArticle";

const FILE_MAP: Record<string, string> = {
  "data-import-export": "advanced-features-data-import-export.md",
  "multiple-donors": "advanced-features-multiple-donors.md",
  "ai-settings": "advanced-features-ai-settings.md",
  "compliance-automation": "advanced-features-compliance-automation.md",
  "roles-and-permissions": "advanced-features-roles-and-permissions.md",
  "team-management": "advanced-features-team-management.md",
  "imported-vs-linked-data": "advanced-features-imported-vs-linked-data.md",
  "templates": "advanced-features-templates.md",
  "advanced-features": "advanced-features-ai-settings.md",
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
  return supportArticleMetadata("advanced-features", article);
}

export default async function AdvancedFeaturesArticlePage({
  params,
}: {
  params: Promise<{ article: string }>;
}) {
  const { article } = await params;
  return (
    <CategoryArticle
      categorySlug="advanced-features"
      categoryLabel="Advanced Features"
      accent="skyline"
      article={article}
      relPath={FILE_MAP[article]}
    />
  );
}
