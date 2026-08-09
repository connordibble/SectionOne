import type { Metadata } from "next";
import { Big_Shoulders, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
      : "https://sectiononesports.com"),
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
      className={`${bigShoulders.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
