"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Global error boundary — only triggered when the root `[locale]/layout.tsx`
 * itself throws (catastrophic). Most app errors are caught by the nested
 * `error.tsx` files; this is the last-resort fallback.
 *
 * Required by `@sentry/nextjs` to capture render errors from the App
 * Router's root segment. Without it, those errors bypass the SDK.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          margin: 0,
          padding: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            padding: 32,
            backgroundColor: "white",
            borderRadius: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "#0f172a", margin: 0 }}>
            Une erreur est survenue
          </h1>
          <p style={{ color: "#64748b", marginTop: 8, lineHeight: 1.5 }}>
            L'équipe technique a été notifiée automatiquement. Vous pouvez réessayer ou
            recharger la page.
          </p>
          {error.digest ? (
            <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 16, fontFamily: "monospace" }}>
              Réf : {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              padding: "10px 20px",
              backgroundColor: "#06b6d4",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
