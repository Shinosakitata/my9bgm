import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://my9bgm.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "My 9 BGM",
    template: "%s | My 9 BGM",
  },
  description:
    "あなたの好きなゲームBGMを9曲選んで、3×3のMY 9として共有できるサービスです。",
  applicationName: "My 9 BGM",
  keywords: [
    "My 9 BGM",
    "ゲームBGM",
    "ゲーム音楽",
    "BGM",
    "ゲーム",
    "音楽",
    "MY9",
  ],
  authors: [{ name: "My 9 BGM" }],
  creator: "My 9 BGM",
  publisher: "My 9 BGM",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: siteUrl,
    siteName: "My 9 BGM",
    title: "My 9 BGM",
    description:
      "あなたの好きなゲームBGMを9曲選んで、3×3のMY 9として共有しよう。",
  },
  twitter: {
    card: "summary_large_image",
    title: "My 9 BGM",
    description:
      "あなたの好きなゲームBGMを9曲選んで、3×3のMY 9として共有しよう。",
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
      <body>{children}</body>
    </html>
  );
}
