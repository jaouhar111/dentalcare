"use client";

import { useTransition } from "react";
import { toast } from "sonner";

/**
 * Downloads a zip of the patient's full record. Calls the GET handler at
 * `/api/patients/[id]/export` which streams the zip back; we anchor it to
 * a hidden link and click programmatically so the browser uses the right
 * filename without leaving the page.
 */
export function GdprExportButton({
  patientId,
  patientName,
}: {
  patientId: string;
  patientName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/patients/${patientId}/export`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error("Échec de l'export", {
            description: body.error ?? "Réessayez dans quelques instants.",
          });
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const cd = res.headers.get("Content-Disposition") ?? "";
        const match = /filename="([^"]+)"/.exec(cd);
        const filename = match?.[1] ?? `dossier-${patientName.replace(/\s+/g, "-")}.zip`;
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success("Export prêt", {
          description: "Le dossier RGPD a été téléchargé.",
        });
      } catch {
        toast.error("Échec de l'export");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="border-input hover:bg-muted bg-background inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50"
      title="Télécharger toutes les données du patient (loi 09-08 / RGPD)"
    >
      <svg
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"
        />
      </svg>
      {isPending ? "Export…" : "Export RGPD"}
    </button>
  );
}
