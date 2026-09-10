import { ImageResponse } from "next/og";
import { getSharedSet } from "../../../lib/sharedSet";

export const alt = "選ばれた9つのゲーム音楽";
export const size = { width: 1200, height: 1200 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

function fallbackImage(index: number) {
  const colors = ["0ea5e9", "6366f1", "a855f7", "f43f5e", "f59e0b", "22c55e", "14b8a6", "3b82f6", "ec4899"];
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420"><rect width="420" height="420" fill="#${colors[index % colors.length]}"/><circle cx="210" cy="210" r="68" fill="rgba(255,255,255,0.18)"/><text x="210" y="238" text-anchor="middle" fill="white" font-family="sans-serif" font-size="84" font-weight="700">♪</text></svg>`)}`;
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
    <div style={{ width: "100%", height: "100%", display: "flex", overflow: "hidden", background: "#0f172a", color: "white", fontFamily: "sans-serif" }}>
      <div style={{ width: "1200px", height: "1200px", display: "flex", flexWrap: "wrap" }}>
        {sources.map((src, index) => (
          <div key={index} style={{ width: "400px", height: "400px", display: "flex", position: "relative", overflow: "hidden", border: "1px solid rgba(255,255,255,0.18)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" width="400" height="400" style={{ width: "400px", height: "400px", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(to bottom, transparent 42%, rgba(0,0,0,0.94) 100%)" }} />
            <div style={{ position: "absolute", left: "18px", top: "18px", width: "46px", height: "46px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: "rgba(255,255,255,0.94)", color: "#0f172a", fontSize: "21px", fontWeight: 900 }}>
              {index + 1}
            </div>
            <div style={{ position: "absolute", left: "24px", right: "24px", bottom: "25px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", whiteSpace: "nowrap", overflow: "hidden", fontSize: "28px", lineHeight: 1.15, fontWeight: 900 }}>{set?.bgms[index]?.title ?? ""}</div>
              <div style={{ display: "flex", marginTop: "8px", whiteSpace: "nowrap", overflow: "hidden", color: "rgba(255,255,255,0.76)", fontSize: "17px" }}>{set?.bgms[index]?.game_title ?? ""}</div>
            </div>
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
