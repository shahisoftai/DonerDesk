import type { Metadata } from "next";
import { supportArticleMetadata } from "@/lib/seo";
import { CategoryArticle } from "@/components/support/CategoryArticle";

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
  return (
    <CategoryArticle
      categorySlug="account-billing"
      categoryLabel="Account & Billing"
      accent="seafoam"
      article={article}
      relPath={FILE_MAP[article]}
    />
  );
}
