import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "AugLeak: find the test images your model has already seen";

export default function OG() {
  const rows = [0, 1, 2, 3];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0b1524", color: "#ffffff", padding: 72, position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 640 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 40, fontWeight: 700 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ width: 22, height: 40, borderRadius: 5, border: "4px solid #5f95d6" }} />
              <div style={{ width: 22, height: 40, borderRadius: 5, border: "4px solid #e0a43a" }} />
            </div>
            AugLeak
          </div>
          <div style={{ fontSize: 86, fontWeight: 800, lineHeight: 1, letterSpacing: -2, marginTop: 70 }}>Your test set has seen this before.</div>
          <div style={{ fontSize: 34, marginTop: 30, color: "#a5b2c4" }}>Find the augmented copies that leak across your split.</div>
        </div>
        <div style={{ position: "absolute", right: 72, top: 120, display: "flex", flexDirection: "column", gap: 22 }}>
          {rows.map((r) => (
            <div key={r} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ width: 84, height: 84, borderRadius: 10, border: "4px solid #e0a43a", background: "#2b2414" }} />
              <div style={{ width: 120, height: 4, background: r % 2 ? "rgba(255,255,255,0.15)" : "#ff3d74" }} />
              <div style={{ width: 84, height: 84, borderRadius: 10, border: "4px solid #5f95d6", background: "#1b2d4b" }} />
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
