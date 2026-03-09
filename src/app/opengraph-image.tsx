import { ImageResponse } from "next/og";

export const alt = "My Offer Agent — AI-Powered Career Assistant";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#0a0a0f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle gradient overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "radial-gradient(circle at 30% 50%, rgba(20, 184, 166, 0.12) 0%, transparent 60%)",
            display: "flex",
          }}
        />

        {/* Bottom accent line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, #0f766e, #14b8a6, #0f766e)",
            display: "flex",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 48,
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: 32,
              background: "linear-gradient(135deg, #0f766e, #14b8a6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="80"
              height="80"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon
                points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                fill="#ffffff"
              />
            </svg>
          </div>

          {/* Text */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 14,
                alignItems: "baseline",
              }}
            >
              <span
                style={{
                  fontSize: 64,
                  fontWeight: 700,
                  color: "#f5f5f5",
                  letterSpacing: -2,
                  lineHeight: 1,
                }}
              >
                My Offer
              </span>
              <span
                style={{
                  fontSize: 64,
                  fontWeight: 700,
                  color: "#14b8a6",
                  letterSpacing: -2,
                  lineHeight: 1,
                }}
              >
                Agent
              </span>
            </div>
            <span
              style={{
                fontSize: 24,
                color: "#a1a1aa",
                letterSpacing: 0.5,
              }}
            >
              AI-Powered Career Assistant
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
