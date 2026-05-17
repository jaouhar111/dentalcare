"use client";

import { useState, useTransition } from "react";
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
  defaultLocale: string;
  invoiceStartingNumber: number;
}

/**
 * Settings form — clinic profile + contact info. The `invoiceStartingNumber`
 * is read-only because it was randomised at clinic creation and changing it
 * after the fact would break the F-YYYY-NNNN sequence (Phase 9 invariant).
 */
export function SettingsForm({ clinic }: { clinic: ClinicForEdit }) {
  const t = useTranslations("Settings");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(clinic.name);
  const [address, setAddress] = useState(clinic.address ?? "");
  const [phone, setPhone] = useState(clinic.phone ?? "");
  const [email, setEmail] = useState(clinic.email ?? "");
  const [vatNumber, setVatNumber] = useState(clinic.vatNumber ?? "");
  const [defaultLocale, setDefaultLocale] = useState<"fr" | "en" | "ar">(
    (["fr", "en", "ar"].includes(clinic.defaultLocale) ? clinic.defaultLocale : "fr") as
      | "fr"
      | "en"
      | "ar",
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateClinic({
        name,
        address: address || undefined,
        phone: phone || undefined,
        email: email || undefined,
        vatNumber: vatNumber || undefined,
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
      {/* Profile */}
      <section className="bg-card border-border/60 space-y-4 rounded-xl border p-6">
        <h2 className="text-foreground text-sm font-semibold tracking-wider uppercase">
          {t("sections.clinic")}
        </h2>
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
            className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-foreground mb-1 block text-xs font-medium">
            {t("form.defaultLocale")}
          </label>
          <select
            value={defaultLocale}
            onChange={(e) => setDefaultLocale(e.target.value as "fr" | "en" | "ar")}
            disabled={isPending}
            className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </div>
      </section>

      {/* Contact */}
      <section className="bg-card border-border/60 space-y-4 rounded-xl border p-6">
        <h2 className="text-foreground text-sm font-semibold tracking-wider uppercase">
          {t("sections.contact")}
        </h2>
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
              className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
            />
          </div>
        </div>
      </section>

      {/* Billing */}
      <section className="bg-card border-border/60 space-y-4 rounded-xl border p-6">
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
        <Button type="submit" disabled={isPending}>
          {isPending ? t("form.submitting") : t("form.submit")}
        </Button>
      </div>
    </form>
  );
}
