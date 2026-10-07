import type { MetadataRoute } from "next";
import { SITE_URL, supportPaths } from "@/lib/seo";

const STATIC: Array<{ path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
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
