import type { Metadata } from "next";
import { WIKI_CATEGORIES } from "@/components/support/wikiCategories";

export const SITE_URL = "https://donordesk.online";
export const SITE_NAME = "DonorDesk";

/** Routes that must never be indexed (auth, checkout, invites, session endpoints). */
export const NOINDEX_METADATA: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export function supportCategory(slug: string) {
  return WIKI_CATEGORIES.find((c) => c.slug === slug);
}

export function supportCategoryMetadata(slug: string): Metadata {
  const cat = supportCategory(slug);
  if (!cat) return {};
  const path = `/support/${slug}`;
  return {
    title: `${cat.name} — Support Center`,
    description: cat.description,
    alternates: { canonical: path },
    openGraph: { title: `${cat.name} — DonorDesk Support Center`, description: cat.description, url: path, type: "website" },
  };
}

export function supportArticleMetadata(slug: string, article: string): Metadata {
  const cat = supportCategory(slug);
  const entry = cat?.articles.find((a) => a.href === `/support/${slug}/${article}`);
  if (!cat || !entry) return {};
  return {
    title: `${entry.title} — ${cat.name}`,
    description: entry.description,
    alternates: { canonical: entry.href },
    openGraph: { title: `${entry.title} — DonorDesk Support`, description: entry.description, url: entry.href, type: "article", section: cat.name },
  };
}

/** Every indexable support URL, derived from the same catalogue that drives the navigation. */
export function supportPaths(): string[] {
  const paths = new Set<string>([
    "/support",
    "/support/contact",
    "/support/reference-faq",
    "/support/reference-glossary",
    "/support/reference-file-formats",
    "/support/reference-error-codes",
    "/support/reference-keyboard-shortcuts",
    "/support/reference-donor-reporting-guidelines",
  ]);
  for (const cat of WIKI_CATEGORIES) {
    paths.add(`/support/${cat.slug}`);
    for (const a of cat.articles) paths.add(a.href);
  }
  return [...paths];
}
