"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BloodGroup, CommunicationChannel, Gender } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPatient, updatePatient } from "@/server/actions/patients";

const GENDERS: Gender[] = [Gender.MALE, Gender.FEMALE, Gender.OTHER];
const BLOOD_GROUPS: BloodGroup[] = [
  BloodGroup.A_POSITIVE,
  BloodGroup.A_NEGATIVE,
  BloodGroup.B_POSITIVE,
  BloodGroup.B_NEGATIVE,
  BloodGroup.AB_POSITIVE,
  BloodGroup.AB_NEGATIVE,
  BloodGroup.O_POSITIVE,
  BloodGroup.O_NEGATIVE,
];
const CHANNELS: CommunicationChannel[] = [
  CommunicationChannel.WHATSAPP,
  CommunicationChannel.EMAIL,
  CommunicationChannel.PHONE,
];
const LOCALES = ["fr", "en", "ar"] as const;

export interface PatientFormValues {
  id?: string;
  firstName: string;
  lastName: string;
  cin: string;
  phone: string;
  email: string;
  dob: string; // yyyy-mm-dd
  gender: Gender | "";
  address: string;
  city: string;
  bloodGroup: BloodGroup | "";
  medicalHistory: string;
  preferredChannel: CommunicationChannel;
  preferredLocale: "fr" | "en" | "ar";
  photoConsent: boolean;
  allergies: string[];
}

/**
 * @param onSuccess optional callback invoked after a successful save.
 *   Receives the created/updated patient id. When provided, the form delegates
 *   navigation to the caller (e.g. modal wrappers close themselves + show toast).
 *   When omitted, the form falls back to navigating to the detail page.
 */
export function PatientForm({
  initial,
  onSuccess,
}: {
  initial: PatientFormValues;
  onSuccess?: (id: string, action: "create" | "update", displayName: string) => void;
}) {
  const t = useTranslations("PatientForm");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<PatientFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [allergyDraft, setAllergyDraft] = useState("");
  const isEdit = !!initial.id;

  function set<K extends keyof PatientFormValues>(key: K, value: PatientFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function addAllergy() {
    const v = allergyDraft.trim();
    if (!v) return;
    if (values.allergies.includes(v)) {
      setAllergyDraft("");
      return;
    }
    set("allergies", [...values.allergies, v]);
    setAllergyDraft("");
  }

  function removeAllergy(label: string) {
    set(
      "allergies",
      values.allergies.filter((a) => a !== label),
    );
  }

  function onSubmit() {
    setErrors({});
    startTransition(async () => {
      const payload = {
        firstName: values.firstName,
        lastName: values.lastName,
        cin: values.cin || undefined,
        phone: values.phone,
        email: values.email || undefined,
        dob: values.dob,
        gender: (values.gender || undefined) as Gender | undefined,
        address: values.address || undefined,
        city: values.city || undefined,
        bloodGroup: (values.bloodGroup || undefined) as BloodGroup | undefined,
        medicalHistory: values.medicalHistory || undefined,
        preferredChannel: values.preferredChannel,
        preferredLocale: values.preferredLocale,
        photoConsent: values.photoConsent,
        allergies: values.allergies,
      };

      const res = isEdit
        ? await updatePatient({ ...payload, id: initial.id! })
        : await createPatient(payload);

      if (!res.ok) {
        const fields = res.error.fields ?? { _form: [res.error.code] };
        const normalized: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(fields)) {
          if (v) normalized[k] = v;
        }
        setErrors(normalized);
        toast.error(tToast("error"), { description: tToast("errorDesc") });
        return;
      }

      const displayName = `${values.firstName} ${values.lastName}`.trim();
      const action: "create" | "update" = isEdit ? "update" : "create";

      if (onSuccess) {
        onSuccess(res.data.id, action, displayName);
        return;
      }

      // Default behaviour (standalone pages) — navigate to the detail view +
      // surface a toast. `replace` keeps the form URL out of the history.
      toast.success(tToast(isEdit ? "patientUpdated" : "patientCreated"), {
        description: tToast(isEdit ? "patientUpdatedDesc" : "patientCreatedDesc", {
          name: displayName,
        }),
      });
      router.replace(`/patients/${res.data.id}` as never);
    });
  }

  const err = (k: string) => errors[k]?.[0];

  return (
    <form action={() => onSubmit()} className="space-y-8">
      {/* ─── Identity ─── */}
      <Section title={t("sections.identity")}>
        <Field
          label={t("fields.firstName")}
          required
          error={err("firstName") && t(`errors.${err("firstName")}`)}
        >
          <Input
            value={values.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            required
            autoComplete="given-name"
          />
        </Field>
        <Field
          label={t("fields.lastName")}
          required
          error={err("lastName") && t(`errors.${err("lastName")}`)}
        >
          <Input
            value={values.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            required
            autoComplete="family-name"
          />
        </Field>
        <Field
          label={t("fields.cin")}
          help={t("fields.cinHelp")}
          error={err("cin") && t(`errors.${err("cin")}`)}
        >
          <Input value={values.cin} onChange={(e) => set("cin", e.target.value)} />
        </Field>
        <Field label={t("fields.dob")} required error={err("dob") && t(`errors.${err("dob")}`)}>
          <Input
            type="date"
            value={values.dob}
            onChange={(e) => set("dob", e.target.value)}
            required
          />
        </Field>
        <Field label={t("fields.gender")}>
          <Select value={values.gender} onChange={(v) => set("gender", v as Gender | "")}>
            <option value="">—</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {t(`gender.${g}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("fields.bloodGroup")}>
          <Select
            value={values.bloodGroup}
            onChange={(v) => set("bloodGroup", v as BloodGroup | "")}
          >
            <option value="">—</option>
            {BLOOD_GROUPS.map((b) => (
              <option key={b} value={b}>
                {t(`bloodGroup.${b}`)}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      {/* ─── Contact ─── */}
      <Section title={t("sections.contact")}>
        <Field
          label={t("fields.phone")}
          required
          help={t("fields.phoneHelp")}
          error={err("phone") && t(`errors.${err("phone")}`)}
        >
          <Input
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            required
            placeholder="0612 345 678"
            autoComplete="tel"
          />
        </Field>
        <Field label={t("fields.email")} error={err("email") && t(`errors.${err("email")}`)}>
          <Input
            type="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            autoComplete="email"
          />
        </Field>
        <Field label={t("fields.address")} colSpan={2}>
          <Input value={values.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label={t("fields.city")}>
          <Input value={values.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
      </Section>

      {/* ─── Medical ─── */}
      <Section title={t("sections.medical")}>
        <Field label={t("fields.allergies")} help={t("fields.allergiesHelp")} colSpan={2}>
          <div className="space-y-2">
            <Input
              value={allergyDraft}
              onChange={(e) => setAllergyDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAllergy();
                }
              }}
              placeholder="Pénicilline, Latex, …"
            />
            {values.allergies.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {values.allergies.map((a) => (
                  <span
                    key={a}
                    className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900"
                  >
                    {a}
                    <button
                      type="button"
                      aria-label={`Remove ${a}`}
                      onClick={() => removeAllergy(a)}
                      className="hover:text-rose-900 dark:hover:text-rose-100"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </Field>
        <Field label={t("fields.medicalHistory")} colSpan={2}>
          <textarea
            value={values.medicalHistory}
            onChange={(e) => set("medicalHistory", e.target.value)}
            rows={3}
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
          />
        </Field>
      </Section>

      {/* ─── Preferences ─── */}
      <Section title={t("sections.preferences")}>
        <Field label={t("fields.preferredChannel")}>
          <Select
            value={values.preferredChannel}
            onChange={(v) => set("preferredChannel", v as CommunicationChannel)}
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {t(`channel.${c}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("fields.preferredLocale")}>
          <Select
            value={values.preferredLocale}
            onChange={(v) => set("preferredLocale", v as "fr" | "en" | "ar")}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {t(`locale.${l}`)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="md:col-span-2">
          <label className="hover:bg-muted/40 border-border/60 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition">
            <input
              type="checkbox"
              checked={values.photoConsent}
              onChange={(e) => set("photoConsent", e.target.checked)}
              className="text-primary focus-visible:ring-primary/50 mt-0.5 size-4 rounded border-slate-300 focus-visible:ring-3"
            />
            <div className="text-sm">
              <div className="font-medium">{t("fields.photoConsent")}</div>
              <div className="text-muted-foreground mt-0.5 text-xs">
                {t("fields.photoConsentHelp")}
              </div>
            </div>
          </label>
        </div>
      </Section>

      {errors._form && (
        <div role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {t("errors._form")}
        </div>
      )}

      <div className="border-border/60 bg-card/95 sticky bottom-0 -mx-6 -mb-6 flex items-center justify-end gap-2 border-t px-6 py-3 backdrop-blur lg:-mx-8 lg:px-8">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? t("submitLoading") : t("submit")}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
        {title}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  help,
  error,
  colSpan,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  error?: string;
  colSpan?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <div className={colSpan === 2 ? "md:col-span-2" : undefined}>
      <label className="text-foreground mb-1.5 block text-sm font-medium">
        {label}
        {required && <span className="text-destructive ms-0.5">*</span>}
      </label>
      {children}
      {help && !error && <p className="text-muted-foreground mt-1 text-xs">{help}</p>}
      {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
    >
      {children}
    </select>
  );
}
