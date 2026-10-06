import { ImageResponse } from "next/og";

// Link preview for messengers and social sites. Static on purpose: it is rendered at
// build time, so it never touches the database.
export const alt = "Maʼnaviyat Xaritasi — soʻz assotsiatsiyasi oʻyini va soʻrovnoma";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GOLD = "#dcb873";
const BG = "#111315";

/** The site's association-network mark, scaled up. */
function Mark() {
  return (
    <svg width="220" height="220" viewBox="0 0 32 32">
      <path d="M16 16 7 9M16 16l10-5M16 16l-3 10M16 16l9 7" stroke={GOLD} strokeOpacity=".5" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="7" cy="9" r="2.6" fill={GOLD} fillOpacity=".6" />
      <circle cx="26" cy="11" r="2.2" fill={GOLD} fillOpacity=".6" />
      <circle cx="13" cy="26" r="2.2" fill={GOLD} fillOpacity=".6" />
      <circle cx="25" cy="23" r="1.8" fill={GOLD} fillOpacity=".6" />
      <circle cx="16" cy="16" r="4.4" fill={GOLD} />
    </svg>
  );
}

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: "0 90px",
          background: BG,
          color: "#e7e4dd",
        }}
      >
        <Mark />
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 760 }}>
          <div style={{ fontSize: 36, color: GOLD, letterSpacing: 4, textTransform: "uppercase" }}>Ilmiy tadqiqot</div>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05 }}>Maʼnaviyat Xaritasi</div>
          <div style={{ fontSize: 38, color: "#a7afb6", lineHeight: 1.3 }}>
            «Maʼnaviyat» deganda xayolingizga nima keladi? 5 daqiqalik soʻz oʻyini.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
