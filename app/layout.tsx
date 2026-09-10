import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SITE_URL } from "../lib/site";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "My9GameMusic",
    template: "%s | My9GameMusic",
  },
  description:
    "好きなゲーム音楽を9曲選んで、あなただけの一枚を作ろう。",
  applicationName: "My9GameMusic",
  keywords: [
    "My9GameMusic",
    "ゲーム音楽",
    "ゲーム音楽",
    "音楽",
    "ゲーム",
    "音楽",
    "MY9",
  ],
  authors: [{ name: "My9GameMusic" }],
  creator: "My9GameMusic",
  publisher: "My9GameMusic",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: SITE_URL,
    siteName: "My9GameMusic",
    title: "私を彩る9つのゲーム音楽 | My9GameMusic",
    description:
      "好きなゲーム音楽を9曲選んで、あなただけの一枚を作ろう。",
  },
  twitter: {
    card: "summary_large_image",
    title: "私を彩る9つのゲーム音楽 | My9GameMusic",
    description:
      "好きなゲーム音楽を9曲選んで、あなただけの一枚を作ろう。",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
