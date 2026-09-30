import { SITE_URL, supportCategory } from "@/lib/seo";

/** Article + BreadcrumbList structured data for a support article. */
export function SupportJsonLd({ categorySlug, article, title }: { categorySlug: string; article: string; title: string }) {
  const cat = supportCategory(categorySlug);
  const entry = cat?.articles.find((a) => a.href === `/support/${categorySlug}/${article}`);
  if (!cat || !entry) return null;
  const url = `${SITE_URL}${entry.href}`;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: title,
        description: entry.description,
        url,
        mainEntityOfPage: url,
        articleSection: cat.name,
        inLanguage: "en",
        author: { "@id": `${SITE_URL}/#organization` },
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Support Center", item: `${SITE_URL}/support` },
          { "@type": "ListItem", position: 2, name: cat.name, item: `${SITE_URL}/support/${categorySlug}` },
          { "@type": "ListItem", position: 3, name: title, item: url },
        ],
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
