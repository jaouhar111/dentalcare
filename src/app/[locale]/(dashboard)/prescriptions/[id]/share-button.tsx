"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { normalizeMoroccanPhone } from "@/lib/utils/phone";

/**
 * Generic "Send WhatsApp" button used by both the prescription and invoice
 * print pages.
 *
 * Two-step flow:
 *   1. POST to `shareEndpoint` — the server renders a PDF, uploads it to
 *      Cloudinary, and returns a public URL.
 *   2. Open `wa.me/<phone>?text=<title>\n<URL>` so the dentist can review
 *      and hit send. The patient receives a clickable link that opens the
 *      real PDF in their browser.
 *
 * NOTE: WhatsApp's wa.me deep link cannot attach a file directly (security
 * design — see commentary on `app/api/prescriptions/[id]/share/route.ts`).
 * Genuine "document message" attachments require the Meta Business API with
 * a template that has a DOCUMENT header component approved by Meta.
 */
export function ShareWhatsAppButton({
  phone,
  title,
  shareEndpoint,
  label,
}: {
  phone: string;
  /// Short title prepended to the URL in the WhatsApp message ("Facture F-2026-1234").
  title: string;
  /// Server endpoint that returns `{ ok, url }` (the Cloudinary PDF URL).
  shareEndpoint: string;
  label: string;
}) {
  const tToast = useTranslations("Toast");
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      try {
        const res = await fetch(shareEndpoint, { method: "POST" });
        if (!res.ok) {
          toast.error(tToast("error"), { description: tToast("errorDesc") });
          return;
        }
        const data = (await res.json()) as {
          ok: boolean;
          url?: string;
          error?: string;
          warning?: string | null;
        };
        if (!data.ok || !data.url) {
          toast.error(tToast("error"), { description: data.error ?? tToast("errorDesc") });
          return;
        }
        // Surface the "Cloudinary not configured" case so the dentist knows
        // the link won't actually reach the patient outside the local network.
        if (data.warning === "CLOUDINARY_NOT_CONFIGURED") {
          toast.warning("⚠ Cloudinary non configuré", {
            description:
              "Le PDF est sauvegardé localement — le lien envoyé ne sera pas accessible depuis le téléphone du patient. Configurez CLOUDINARY_* dans .env pour la production.",
            duration: 10_000,
          });
        }
        const normalized = normalizeMoroccanPhone(phone);
        const digits = normalized ? normalized.replace(/^\+/, "") : "";
        const message = `${title}\n${data.url}`;
        const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
        window.open(url, "_blank", "noopener,noreferrer");
      } catch {
        toast.error(tToast("error"), { description: tToast("errorDesc") });
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={isPending}
      className="gap-1.5"
    >
      <svg className="size-4 text-emerald-600" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
      {label}
    </Button>
  );
}
