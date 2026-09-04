import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded fallback card for every route that doesn't define its own
// (vehicles/[vehicleId] overrides this with a per-listing photo card).
// Without this, sharing the homepage/about/trust/etc. link on WhatsApp,
// iMessage, or Facebook rendered no preview image at all.
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(155deg, #183b32, #0d271f)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 40, fontWeight: 700 }}>
          <span>yo</span>
          <span style={{ color: "#f18a65" }}>Rento</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 58, fontWeight: 700, lineHeight: 1.1, maxWidth: 820 }}>Your next journey starts here.</div>
          <div style={{ fontSize: 28, color: "rgba(255,255,255,.75)" }}>A trusted vehicle marketplace born in the Dominican Republic.</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
