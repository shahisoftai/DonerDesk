import type { MetadataRoute } from "next";
import { SITE_URL, supportPaths } from "@/lib/seo";
import { SECTOR_PAGES } from "@/components/site/site-data";

const STATIC: Array<{ path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/platform", priority: 0.9, changeFrequency: "monthly" },
  { path: "/features", priority: 0.9, changeFrequency: "monthly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
  { path: "/compare", priority: 0.8, changeFrequency: "monthly" },
  { path: "/solutions", priority: 0.8, changeFrequency: "monthly" },
  ...SECTOR_PAGES.map((s) => ({ path: `/solutions/${s.slug}`, priority: 0.7, changeFrequency: "monthly" as const })),
  { path: "/tour", priority: 0.8, changeFrequency: "monthly" },
  { path: "/security", priority: 0.7, changeFrequency: "monthly" },
  { path: "/signup", priority: 0.7, changeFrequency: "monthly" },
  { path: "/contact-sales", priority: 0.6, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/cookies", priority: 0.3, changeFrequency: "yearly" },
  { path: "/dpa", priority: 0.3, changeFrequency: "yearly" },
  { path: "/subprocessors", priority: 0.3, changeFrequency: "yearly" },
  { path: "/acceptable-use", priority: 0.3, changeFrequency: "yearly" },
  { path: "/refunds", priority: 0.3, changeFrequency: "yearly" },
  { path: "/maps/sources", priority: 0.2, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const support = supportPaths().map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "monthly" as const,
    priority: path === "/support" ? 0.7 : path.split("/").length > 3 ? 0.5 : 0.6,
  }));
  return [
    ...STATIC.map((s) => ({ url: s.path === "/" ? SITE_URL : `${SITE_URL}${s.path}`, changeFrequency: s.changeFrequency, priority: s.priority })),
    ...support,
  ];
}
