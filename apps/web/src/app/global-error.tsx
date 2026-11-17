"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary. Next replaces the root layout with this component, so
 * it cannot rely on Tailwind, the font variables, or any other app component.
 * Everything here is inline so the jewel palette survives a broken document.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled root error", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 20px",
          background:
            "radial-gradient(120% 90% at 18% 8%, rgba(14,159,110,0.18), transparent 62%), radial-gradient(110% 85% at 84% 0%, rgba(59,91,255,0.16), transparent 64%), linear-gradient(140deg, #070F24 0%, #0E1B3D 58%, #152A5E 100%)",
          color: "#FFFFFF",
          fontFamily:
            "var(--font-inter), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          textAlign: "center",
        }}
      >
        <main id="main" style={{ width: "100%", maxWidth: "34rem" }}>
          <p
            style={{
              margin: 0,
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#E3C489",
            }}
          >
            University Talent Network
          </p>

          <h1
            style={{
              margin: "18px 0 0",
              fontSize: "clamp(2rem, 6vw, 2.75rem)",
              lineHeight: 1.1,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            The app needs a <span style={{ color: "#E3C489" }}>fresh start.</span>
          </h1>

          <p
            style={{
              margin: "16px auto 0",
              maxWidth: "26rem",
              fontSize: "14px",
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.66)",
            }}
          >
            A critical error stopped this page from rendering. Reload to reconnect — your account
            and data are untouched.
          </p>

          {error.digest ? (
            <p
              style={{
                margin: "20px 0 0",
                fontSize: "11px",
                letterSpacing: "0.06em",
                color: "rgba(255,255,255,0.55)",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              Reference {error.digest}
            </p>
          ) : null}

          <div
            style={{
              marginTop: "32px",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                height: "48px",
                padding: "0 22px",
                border: "1px solid rgba(200,164,93,0.55)",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #E9CF96 0%, #C8A45D 52%, #A9853F 100%)",
                color: "#070F24",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload the page
            </button>
            <a
              href="/"
              style={{
                height: "48px",
                display: "inline-flex",
                alignItems: "center",
                padding: "0 22px",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.04)",
                color: "#FFFFFF",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Back to home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
