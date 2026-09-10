import { ImageResponse } from "next/og";
import { getSharedSet, sharedSetTitle } from "../../../lib/sharedSet";

export const alt = "選ばれた9つのゲーム音楽";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

function fallbackImage(index: number) {
  const colors = ["0ea5e9", "6366f1", "a855f7", "f43f5e", "f59e0b", "22c55e", "14b8a6", "3b82f6", "ec4899"];
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420"><rect width="800" height="420" fill="#${colors[index % colors.length]}"/><circle cx="400" cy="210" r="78" fill="rgba(255,255,255,0.18)"/><text x="400" y="242" text-anchor="middle" fill="white" font-family="sans-serif" font-size="96" font-weight="700">♪</text></svg>`)}`;
}

async function imageSource(url: string | null, index: number) {
  if (!url?.startsWith("https://")) return fallbackImage(index);
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
    if (!response.ok || !contentType.startsWith("image/")) return fallbackImage(index);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 5_000_000) return fallbackImage(index);
    return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return fallbackImage(index);
  }
}

export default async function Image({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const set = await getSharedSet(shareId);
  const sources = await Promise.all(
    Array.from({ length: 9 }, (_, index) => imageSource(set?.bgms[index]?.image_url ?? null, index)),
  );

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: "#07111f", color: "white", fontFamily: "sans-serif" }}>
      <div style={{ width: "1200px", height: "630px", display: "flex", flexWrap: "wrap" }}>
        {sources.map((src, index) => (
          <div key={index} style={{ width: "400px", height: "210px", display: "flex", overflow: "hidden", border: "1px solid rgba(255,255,255,0.2)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" width="400" height="210" style={{ width: "400px", height: "210px", objectFit: "cover" }} />
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "92px", padding: "0 34px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(90deg, rgba(2,6,23,0.94), rgba(2,6,23,0.78))", borderTop: "1px solid rgba(255,255,255,0.26)" }}>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: "34px", lineHeight: 1.1, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden" }}>
            {set?.title?.trim() ? sharedSetTitle(set) : "私を彩る9つのゲーム音楽"}
          </div>
          {set?.creator_name ? <div style={{ display: "flex", marginTop: "7px", color: "#dbeafe", fontSize: "17px" }}>作成者：{set.creator_name}</div> : null}
        </div>
        <div style={{ display: "flex", flexShrink: 0, marginLeft: "32px", color: "#7dd3fc", fontSize: "22px", fontWeight: 800, letterSpacing: "0.06em" }}>
          My9GameMusic
        </div>
      </div>
    </div>,
    size,
  );
}
