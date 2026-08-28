// Absolute URLs for Open Graph, canonical links, robots, and the sitemap are
// built from this. Vercel exposes the project's production domain through
// VERCEL_PROJECT_PRODUCTION_URL, so preview builds keep their public canonicals
// on the production host rather than publishing preview-only URLs.
export const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      // www is the canonical host: the apex 308s here, so a canonical tag
      // pointing at the apex would name a URL that immediately redirects.
      : "https://www.sectiononesports.com"),
);
