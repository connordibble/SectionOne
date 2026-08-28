import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Nothing under /api is a page. Crawling the chat endpoint would burn
        // provider budget answering questions no human asked.
        disallow: "/api/",
      },
    ],
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
