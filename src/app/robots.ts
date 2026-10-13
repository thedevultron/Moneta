import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moneta-live.web.app";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/signup", "/onboarding"],
        disallow: ["/api/", "/app/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
