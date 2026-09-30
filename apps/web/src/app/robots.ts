import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/projects",
          "/reports",
          "/evidence",
          "/compliance",
          "/notifications",
          "/audit",
          "/settings",
          "/team",
          "/my-work",
          "/onboarding",
          "/login",
          "/logout",
          "/forgot-password",
          "/reset-password",
          "/invite",
          "/checkout",
          "/thanks",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
