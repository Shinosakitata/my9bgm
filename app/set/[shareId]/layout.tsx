import type { Metadata } from "next";
import { getSharedSet, sharedSetTitle } from "../../../lib/sharedSet";

const description = "好きなゲーム音楽を9曲選んで、あなただけの一枚を作ろう。";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareId: string }>;
}): Promise<Metadata> {
  const { shareId } = await params;
  const set = await getSharedSet(shareId);
  const title = set?.title?.trim()
    ? `${sharedSetTitle(set)} | My9GameMusic`
    : "私を彩る9つのゲーム音楽 | My9GameMusic";
  const path = `/set/${encodeURIComponent(shareId)}`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "ja_JP",
      url: path,
      siteName: "My9GameMusic",
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: set ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default function SharedSetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
