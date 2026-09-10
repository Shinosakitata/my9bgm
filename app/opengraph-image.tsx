import { ImageResponse } from "next/og";

export const alt = "My9GameMusic - 私を彩る9つのゲーム音楽";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default function Image() {
  const tiles = [
    ["SFC · 1994", "MOTHER2", "#fbbf24", "#f97316"],
    ["PS3 · 2011", "Dark Souls", "#1e293b", "#020617"],
    ["PS2 · 2001", "ICO", "#e7e5e4", "#a8a29e"],
    ["N64 · 1998", "時のオカリナ", "#7c3aed", "#4c1d95"],
    ["PS4 · 2015", "Bloodborne", "#7f1d1d", "#1c1917"],
    ["N64 · 1999", "ゼルダの伝説", "#65a30d", "#166534"],
    ["PC · 2018", "Outer Wilds", "#0f172a", "#334155"],
    ["PS4 · 2019", "NieR", "#f9a8d4", "#db2777"],
    ["PC · 1993", "DOOM", "#b91c1c", "#450a0a"],
  ];

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "34px", background: "#050505", fontFamily: "sans-serif" }}>
      <div style={{ width: "1128px", height: "558px", display: "flex", position: "relative", overflow: "hidden", borderRadius: "28px", background: "linear-gradient(145deg, #ffffff, #eef7ff)", boxShadow: "0 20px 55px rgba(0,0,0,0.4)" }}>
        <div style={{ width: "56%", padding: "66px 0 54px 68px", display: "flex", flexDirection: "column", color: "#0f172a" }}>
          <div style={{ display: "flex", alignItems: "center", color: "#0ea5e9", fontSize: "22px", fontWeight: 900, letterSpacing: "0.12em" }}>
            <div style={{ width: "35px", height: "35px", marginRight: "14px", padding: "7px", display: "flex", flexWrap: "wrap", gap: "2px", borderRadius: "9px", background: "#0ea5e9" }}>
              {Array.from({ length: 9 }, (_, index) => <div key={index} style={{ width: "5px", height: "5px", display: "flex", borderRadius: "1px", background: "white" }} />)}
            </div>
            MY 9 GAME MUSIC
          </div>
          <div style={{ display: "flex", marginTop: "48px", color: "#0284c7", fontSize: "24px", lineHeight: 1.25, fontWeight: 800 }}>
            The nine game tracks
            <br />that color my life.
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: "22px", fontWeight: 900, letterSpacing: "-0.04em" }}>
            <div style={{ display: "flex", fontSize: "54px", lineHeight: 1.05 }}>私を彩る</div>
            <div style={{ display: "flex", color: "#0284c7", fontSize: "70px", lineHeight: 1.08 }}>9つのゲーム音楽</div>
          </div>
          <div style={{ display: "flex", marginTop: "auto", color: "#64748b", fontSize: "19px", fontWeight: 700 }}>My9GameMusic</div>
        </div>
        <div style={{ width: "44%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "390px", height: "468px", padding: "15px", display: "flex", flexWrap: "wrap", gap: "8px", borderRadius: "23px", background: "rgba(255,255,255,0.82)", boxShadow: "0 12px 34px rgba(15,23,42,0.2)", transform: "rotate(-2deg)" }}>
            {tiles.map(([meta, title, start, end], index) => (
              <div key={index} style={{ width: "114px", height: "140px", padding: "12px", display: "flex", flexDirection: "column", justifyContent: "space-between", borderRadius: "10px", background: `linear-gradient(145deg, ${start}, ${end})`, color: "white", boxShadow: "0 5px 12px rgba(15,23,42,0.18)" }}>
                <div style={{ display: "flex", fontSize: "10px", fontWeight: 700, opacity: 0.78 }}>{meta}</div>
                <div style={{ display: "flex", fontSize: "12px", fontWeight: 800 }}>{title}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
