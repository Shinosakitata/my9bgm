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

function truncateForTile(value: string | null | undefined, maxUnits: number) {
  const text = value?.trim() ?? "";
  const characters = Array.from(text);
  const displayUnits = (character: string) => (/^[\x00-\x7F]$/.test(character) ? 1 : 2);

  if (characters.reduce((total, character) => total + displayUnits(character), 0) <= maxUnits) {
    return text;
  }

  const suffix = "...";
  let usedUnits = suffix.length;
  let truncated = "";

  for (const character of characters) {
    const characterUnits = displayUnits(character);
    if (usedUnits + characterUnits > maxUnits) break;
    truncated += character;
    usedUnits += characterUnits;
  }

  return `${truncated.trimEnd()}${suffix}`;
}

async function imageSource(url: string | null, index: number) {
  const normalizedUrl = url?.startsWith("//") ? `https:${url}` : url;
  if (!normalizedUrl?.startsWith("https://")) return fallbackImage(index);
  try {
    const parsed = new URL(normalizedUrl);
    if (!["media.rawg.io", "api.rawg.io", "images.igdb.com"].includes(parsed.hostname)) return fallbackImage(index);
    if (parsed.hostname === "media.rawg.io" && parsed.pathname.startsWith("/media/") && !parsed.pathname.startsWith("/media/resize/")) {
      parsed.pathname = parsed.pathname.replace("/media/", "/media/resize/640/-/");
    }
    const response = await fetch(parsed, { next: { revalidate: 604800 }, signal: AbortSignal.timeout(6000) });
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
            <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(to bottom, transparent 25%, rgba(0,0,0,0.22) 42%, rgba(0,0,0,0.88) 68%, #000000 100%)" }} />
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "126px", display: "flex", background: "rgba(0,0,0,0.82)" }} />
            <div style={{ position: "absolute", left: "24px", right: "24px", bottom: "25px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", whiteSpace: "nowrap", color: "#ffffff", fontSize: "28px", lineHeight: 1.15, fontWeight: 900, textShadow: "0 2px 6px rgba(0,0,0,0.95)" }}>{truncateForTile(set?.bgms[index]?.title, 22)}</div>
              <div style={{ display: "flex", marginTop: "8px", whiteSpace: "nowrap", color: "rgba(255,255,255,0.92)", fontSize: "17px", fontWeight: 600, textShadow: "0 1px 4px rgba(0,0,0,0.95)" }}>{truncateForTile(set?.bgms[index]?.game_title, 38)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>,
    {
      ...size,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
