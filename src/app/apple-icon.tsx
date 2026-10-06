import { ImageResponse } from "next/og";

// Home-screen icon for iOS (PNG; Safari ignores SVG favicons there).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const gold = "#dcb873";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1d20" }}>
        <svg width="132" height="132" viewBox="0 0 32 32">
          <path d="M16 16 7 9M16 16l10-5M16 16l-3 10M16 16l9 7" stroke={gold} strokeOpacity=".5" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="7" cy="9" r="2.6" fill={gold} fillOpacity=".6" />
          <circle cx="26" cy="11" r="2.2" fill={gold} fillOpacity=".6" />
          <circle cx="13" cy="26" r="2.2" fill={gold} fillOpacity=".6" />
          <circle cx="25" cy="23" r="1.8" fill={gold} fillOpacity=".6" />
          <circle cx="16" cy="16" r="4.4" fill={gold} />
        </svg>
      </div>
    ),
    size,
  );
}
