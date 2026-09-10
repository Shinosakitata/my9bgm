import { ImageResponse } from "next/og";
import { getSharedSet, sharedSetTitle } from "../../../lib/sharedSet";

export const alt = "選ばれた9つのゲーム音楽";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

function fallbackImage(index: number) {
  const colors = ["0ea5e9", "6366f1", "a855f7", "f43f5e", "f59e0b", "22c55e", "14b8a6", "3b82f6", "ec4899"];
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420"><rect width="420" height="420" fill="#${colors[index % colors.length]}"/><text x="210" y="235" text-anchor="middle" fill="white" font-family="sans-serif" font-size="96" font-weight="700">${index + 1}</text></svg>`)}`;
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
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#07111f", color: "white", fontFamily: "sans-serif" }}>
      <div style={{ width: "630px", height: "630px", display: "flex", flexWrap: "wrap", flexShrink: 0 }}>
        {sources.map((src, index) => (
          <div key={index} style={{ width: "210px", height: "210px", display: "flex", overflow: "hidden", position: "relative", border: "1px solid rgba(255,255,255,0.18)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" width="210" height="210" style={{ width: "210px", height: "210px", objectFit: "cover" }} />
            <div style={{ position: "absolute", left: "10px", top: "10px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: "rgba(2,6,23,0.72)", fontSize: "16px", fontWeight: 700 }}>
              {index + 1}
            </div>
          </div>
        ))}
      </div>
      <div style={{ minWidth: 0, flex: 1, padding: "64px 52px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", color: "#38bdf8", fontSize: "24px", fontWeight: 800, letterSpacing: "0.12em" }}>My9GameMusic</div>
          <div style={{ display: "flex", marginTop: "28px", fontSize: "38px", lineHeight: 1.35, fontWeight: 900, overflowWrap: "anywhere" }}>
            {sharedSetTitle(set)}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", color: "#cbd5e1", fontSize: "22px", lineHeight: 1.5 }}>
          {set?.creator_name ? <div style={{ display: "flex" }}>作成者：{set.creator_name}</div> : null}
          <div style={{ display: "flex", marginTop: "10px", color: "#64748b", fontSize: "18px" }}>my9bgm.vercel.app</div>
        </div>
      </div>
    </div>,
    size,
  );
}
