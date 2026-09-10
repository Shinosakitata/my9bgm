import { ImageResponse } from "next/og";

export const alt = "My 9 BGM - 好きなゲームBGMを9曲選んで共有";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  const tiles = [
    ["#38bdf8", "#0ea5e9"],
    ["#818cf8", "#6366f1"],
    ["#c084fc", "#a855f7"],
    ["#fb7185", "#f43f5e"],
    ["#fbbf24", "#f59e0b"],
    ["#4ade80", "#22c55e"],
    ["#2dd4bf", "#14b8a6"],
    ["#60a5fa", "#3b82f6"],
    ["#f472b6", "#ec4899"],
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "72px 86px",
          background:
            "radial-gradient(circle at 25% 15%, #172554 0%, #080b14 42%, #020617 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: "57%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "24px",
              fontSize: "24px",
              fontWeight: 700,
              color: "#7dd3fc",
              letterSpacing: "0.14em",
            }}
          >
            YOUR FAVORITE GAME MUSIC
          </div>

          <div
            style={{
              display: "flex",
              fontSize: "82px",
              lineHeight: 1,
              fontWeight: 900,
              letterSpacing: "-0.04em",
            }}
          >
            My 9 BGM
          </div>

          <div
            style={{
              display: "flex",
              marginTop: "28px",
              fontSize: "31px",
              lineHeight: 1.45,
              fontWeight: 700,
              color: "#e2e8f0",
            }}
          >
            好きなゲームBGMを9曲選んで、
            <br />
            あなただけのMY 9を共有しよう。
          </div>

          <div
            style={{
              display: "flex",
              marginTop: "34px",
              fontSize: "21px",
              color: "#94a3b8",
            }}
          >
            my9bgm.vercel.app
          </div>
        </div>

        <div
          style={{
            width: "360px",
            height: "360px",
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            transform: "rotate(2deg)",
          }}
        >
          {tiles.map(([a, b], index) => (
            <div
              key={index}
              style={{
                width: "112px",
                height: "112px",
                borderRadius: "22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: `linear-gradient(135deg, ${a}, ${b})`,
                border: "1px solid rgba(255,255,255,0.22)",
                boxShadow: "0 16px 35px rgba(0,0,0,0.28)",
                fontSize: "36px",
                fontWeight: 900,
                color: "rgba(255,255,255,0.95)",
              }}
            >
              {index + 1}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
