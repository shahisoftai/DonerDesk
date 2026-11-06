import type { Metadata } from "next";
import { supportArticleMetadata } from "@/lib/seo";
import { CategoryArticle } from "@/components/support/CategoryArticle";

const FILE_MAP: Record<string, string> = {
  "security-best-practices": "security-best-practices.md",
  "data-handling": "security-privacy-data-handling.md",
  "gdpr-compliance": "security-privacy-gdpr-compliance.md",
  "google-drive-data": "security-privacy-google-drive-data.md",
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
  return supportArticleMetadata("security-privacy", article);
}

export default async function SecurityPrivacyArticlePage({
  params,
}: {
  params: Promise<{ article: string }>;
}) {
  const { article } = await params;
  return (
    <CategoryArticle
      categorySlug="security-privacy"
      categoryLabel="Security & Privacy"
      accent="saffron"
      article={article}
      relPath={FILE_MAP[article]}
    />
  );
}
