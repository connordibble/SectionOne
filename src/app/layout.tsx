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

// The name alone shares a search namespace with Section I Athletics, a New York
// high-school association with 78 member schools. Naming the sport in the title
// is the cheapest way to be the right result for the people looking for us.
export const metadata: Metadata = {
  title: "Section One · College football",
  description: "Your team. Your section. What to watch before kickoff, with sources.",
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
