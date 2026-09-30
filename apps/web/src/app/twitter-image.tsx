import { ImageResponse } from "next/og";

export const alt = "DonorDesk — AI-assisted grant and donor reporting";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #020617 0%, #0f2a4a 100%)",
          color: "white",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, color: "#5eead4", letterSpacing: 2 }}>DonorDesk</div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, marginTop: 24 }}>
          From scattered field evidence to donor-ready reports
        </div>
        <div style={{ fontSize: 32, color: "#cbd5e1", marginTop: 32 }}>
          AI-assisted, source-linked grant and donor reporting for NGOs
        </div>
      </div>
    ),
    size,
  );
}
