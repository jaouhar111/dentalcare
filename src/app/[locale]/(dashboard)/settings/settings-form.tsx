"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { updateClinic } from "@/server/actions/clinic";

interface ClinicForEdit {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  vatNumber: string | null;
  logoUrl: string | null;
  defaultLocale: string;
  invoiceStartingNumber: number;
}

/**
 * Settings form — clinic profile + contact info + logo.
 *
 * Logo upload uses a tiny REST endpoint (`/api/clinic/logo`) instead of a
 * Server Action because Next's RSC layer serialises Server Action bodies
 * as JSON, which doesn't carry binary `File` data cleanly. The endpoint
 * validates size + MIME, persists via Cloudinary, returns the delivery URL.
 *
 * `invoiceStartingNumber` is read-only because it was randomised at clinic
 * creation and changing it would break the F-YYYY-NNNN sequence.
 */
export function SettingsForm({ clinic }: { clinic: ClinicForEdit }) {
  const t = useTranslations("Settings");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(clinic.name);
  const [address, setAddress] = useState(clinic.address ?? "");
  const [phone, setPhone] = useState(clinic.phone ?? "");
  const [email, setEmail] = useState(clinic.email ?? "");
  const [vatNumber, setVatNumber] = useState(clinic.vatNumber ?? "");
  const [logoUrl, setLogoUrl] = useState(clinic.logoUrl ?? "");
  const [defaultLocale, setDefaultLocale] = useState<"fr" | "en">(
    (["fr", "en"].includes(clinic.defaultLocale) ? clinic.defaultLocale : "fr") as
      | "fr"
      | "en",
  );

  async function uploadLogo(file: File) {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/clinic/logo", { method: "POST", body: formData });
      const json = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (!json.ok || !json.url) {
        toast.error("Upload échoué", { description: json.error ?? "Réessayez." });
        return;
      }
      setLogoUrl(json.url);
      toast.success("Logo mis à jour");
      router.refresh();
    } catch {
      toast.error("Upload échoué");
    } finally {
      setIsUploading(false);
    }
  }

  async function removeLogo() {
    setIsUploading(true);
    try {
      const res = await fetch("/api/clinic/logo", { method: "DELETE" });
      const json = (await res.json()) as { ok: boolean };
      if (!json.ok) {
        toast.error("Suppression échouée");
        return;
      }
      setLogoUrl("");
      toast.success("Logo supprimé");
      router.refresh();
    } finally {
      setIsUploading(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateClinic({
        name,
        address: address || undefined,
        phone: phone || undefined,
        email: email || undefined,
        vatNumber: vatNumber || undefined,
        logoUrl: logoUrl || undefined,
        defaultLocale,
      });
      if (!res.ok) {
        toast.error(tToast("error"), { description: res.error.message });
        return;
      }
      toast.success(t("toast.saved"));
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* ─── Branding / Logo ──────────────────────────────────────────── */}
      <section className="card-glass space-y-4">
        <header>
          <h2 className="text-foreground text-sm font-semibold tracking-wider uppercase">
            Identité du cabinet
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Logo + nom + coordonnées — utilisés dans les en-têtes des factures, ordonnances
            et liens WhatsApp envoyés aux patients.
          </p>
        </header>

        {/* Logo upload + preview */}
        <div className="flex items-center gap-4">
          <div
            className="bg-white border-border/60 grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border"
            aria-hidden
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo cabinet"
                className="h-full w-full object-contain"
              />
            ) : (
              <span
                className="grid size-14 place-items-center rounded-xl text-white"
                style={{
                  background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.3), 0 6px 16px var(--accent-glow)",
                }}
              >
                <svg viewBox="0 0 64 64" className="size-10" fill="currentColor" aria-hidden>
                  <path d="M32 5C22 5 14 10 12 21C10 32 13 42 17 51L19 56C20 58 23 58 24 56L26 49C27 46 29 44 32 44C35 44 37 46 38 49L40 56C41 58 44 58 45 56L47 51C51 42 54 32 52 21C50 10 42 5 32 5Z" />
                </svg>
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadLogo(f);
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={isUploading || isPending}
                className="border-input hover:bg-muted bg-background inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition disabled:opacity-50"
              >
                {isUploading ? "Upload…" : logoUrl ? "Remplacer" : "Téléverser un logo"}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={removeLogo}
                  disabled={isUploading || isPending}
                  className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-4 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  Supprimer
                </button>
              )}
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              PNG, JPG, SVG ou WebP — 5 Mo max. Pour un rendu net en facture, choisis une
              image carrée d'au moins 256×256 px avec fond transparent.
            </p>
          </div>
        </div>

        <div>
          <label className="text-foreground mb-1 block text-xs font-medium">
            {t("form.name")} *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            disabled={isPending}
            className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            Apparaît en haut de chaque facture, ordonnance et message WhatsApp.
          </p>
        </div>
        <div>
          <label className="text-foreground mb-1 block text-xs font-medium">
            {t("form.address")}
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={200}
            disabled={isPending}
            placeholder="Ex. 12 rue Mohamed V, Fès 30000"
            className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-foreground mb-1 block text-xs font-medium">
            {t("form.defaultLocale")}
          </label>
          <select
            value={defaultLocale}
            onChange={(e) => setDefaultLocale(e.target.value as "fr" | "en")}
            disabled={isPending}
            className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>
      </section>

      {/* ─── Contact ─────────────────────────────────────────────────── */}
      <section className="card-glass space-y-4">
        <header>
          <h2 className="text-foreground text-sm font-semibold tracking-wider uppercase">
            {t("sections.contact")}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Le numéro de téléphone apparaît dans les rappels WhatsApp envoyés aux patients
            ainsi que dans l'en-tête des PDF.
          </p>
        </header>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-foreground mb-1 block text-xs font-medium">
              {t("form.phone")}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
              disabled={isPending}
              placeholder="+212 5XX XX XX XX"
              className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-foreground mb-1 block text-xs font-medium">
              {t("form.email")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              placeholder="contact@cabinet.ma"
              className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
            />
          </div>
        </div>
      </section>

      {/* ─── Billing ─────────────────────────────────────────────────── */}
      <section className="card-glass space-y-4">
        <h2 className="text-foreground text-sm font-semibold tracking-wider uppercase">
          {t("sections.billing")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-foreground mb-1 block text-xs font-medium">
              {t("form.vatNumber")}
            </label>
            <input
              type="text"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              maxLength={40}
              disabled={isPending}
              className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-foreground mb-1 block text-xs font-medium">
              {t("form.invoiceStart")}
            </label>
            <input
              type="number"
              value={clinic.invoiceStartingNumber}
              disabled
              readOnly
              className="border-input bg-muted num w-full rounded-lg border px-3 py-2 text-sm shadow-xs"
            />
            <p className="text-muted-foreground mt-1 text-xs">{t("form.invoiceStartHint")}</p>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || isUploading}>
          {isPending ? t("form.submitting") : t("form.submit")}
        </Button>
      </div>
    </form>
  );
}
