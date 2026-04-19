import type { MetadataRoute } from "next";
import { getSiteUrl, isPagesDevSiteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  if (isPagesDevSiteUrl()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  const base = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
