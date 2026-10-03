import { ImageResponse } from "next/og";

export const alt = "CertChase: certificates of insurance, tracked and chased.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand colours from docs/spec.md section 6 (hex, since next/og cannot read CSS variables).
const graphite = "#1F2328";
const bone = "#F6F4EF";
const cobalt = "#2458E6";
const slate = "#5B6470";
const gridLine = "rgba(31, 35, 40, 0.07)";
const GRID = 40;

/** Drafting-grid lines drawn as hairline divs: Satori has no repeating backgrounds. */
function Grid() {
  const vertical = Array.from({ length: Math.floor(size.width / GRID) + 1 }, (_, i) => i * GRID);
  const horizontal = Array.from({ length: Math.floor(size.height / GRID) + 1 }, (_, i) => i * GRID);
  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex" }}>
      {vertical.map((x) => (
        <div
          key={`v${x}`}
          style={{ position: "absolute", top: 0, left: x, width: 1, height: size.height, background: gridLine }}
        />
      ))}
      {horizontal.map((y) => (
        <div
          key={`h${y}`}
          style={{ position: "absolute", left: 0, top: y, height: 1, width: size.width, background: gridLine }}
        />
      ))}
    </div>
  );
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          background: bone,
          color: graphite,
          fontFamily: "sans-serif",
        }}
      >
        <Grid />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "80px 80px 72px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 36, height: 36, background: cobalt }} />
            <div style={{ fontSize: 48 }}>CertChase</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 84, lineHeight: 1.08 }}>
              <div>Certificates of insurance,</div>
              <div>tracked and chased.</div>
            </div>
            <div
              style={{
                marginTop: 40,
                paddingTop: 22,
                borderTop: `2px solid ${graphite}`,
                fontSize: 26,
                color: slate,
                display: "flex",
              }}
            >
              The model extracts. The rules decide. Brokers get chased.
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
