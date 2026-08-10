import type { Metadata } from "next";
import { Big_Shoulders, Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const bigShoulders = Big_Shoulders({
  adjustFontFallback: false,
  variable: "--font-big-shoulders",
  subsets: ["latin"],
});

const title = "Section One · College football";
const description = "Your team. Your section. What to watch before kickoff, with sources.";

// Absolute URLs for Open Graph and canonical links are built from this. Vercel
// sets VERCEL_PROJECT_PRODUCTION_URL on every deployment, so previews resolve
// to themselves instead of claiming to be production.
export const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      // www is the canonical host: the apex 308s here, so a canonical tag
      // pointing at the apex would name a URL that immediately redirects.
      : "https://www.sectiononesports.com"),
);

// The name alone shares a search namespace with Section I Athletics, a New York
// high-school association with 78 member schools. Naming the sport in the title
// is the cheapest way to be the right result for the people looking for us.
export const metadata: Metadata = {
  metadataBase: siteUrl,
  title,
  description,
  applicationName: "Section One",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Section One",
    title,
    description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    // Points at the same file rather than shipping a duplicate twitter-image.
    // X falls back to og:image on its own, but a card declared as
    // summary_large_image with no image it can name renders as a bare text
    // card on the platforms that do not fall back.
    images: ["/opengraph-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bigShoulders.variable} ${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
