"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { WaitlistTimePreference } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addToWaitlist } from "@/server/actions/waitlist";
import { PatientPicker } from "../appointments/patient-picker";

export interface WaitlistFormValues {
  patientId: string;
  patientName: string;
  dentistId: string;
  durationMin: number;
  timePreference: WaitlistTimePreference;
  notBefore: string;
  notAfter: string;
  reason: string;
}

export function WaitlistForm({
  initial,
  dentists,
  onSuccess,
}: {
  initial: WaitlistFormValues;
  dentists: Array<{ id: string; name: string }>;
  onSuccess?: () => void;
}) {
  const t = useTranslations("Waitlist.form");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [values, setValues] = useState<WaitlistFormValues>(initial);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof WaitlistFormValues>(k: K, v: WaitlistFormValues[K]) {
    setValues((s) => ({ ...s, [k]: v }));
  }

  function onSubmit() {
    if (!values.patientId) {
      toast.error(tToast("error"), { description: tToast("errorDesc") });
      return;
    }
    startTransition(async () => {
      const res = await addToWaitlist({
        patientId: values.patientId,
        dentistId: values.dentistId || undefined,
        durationMin: values.durationMin,
        timePreference: values.timePreference,
        notBefore: values.notBefore || undefined,
        notAfter: values.notAfter || undefined,
        reason: values.reason || undefined,
      });
      if (!res.ok) {
        toast.error(tToast("error"), { description: tToast("errorDesc") });
        return;
      }
      toast.success(tToast("appointmentCreated").replace("Rendez-vous", "Patient ajouté"));
      if (onSuccess) {
        onSuccess();
      } else {
        router.replace("/waitlist" as never);
      }
    });
  }

  return (
    <form action={() => onSubmit()} className="space-y-5">
      <Field label={t("patient")} required>
        <PatientPicker
          initialPatient={
            values.patientId ? { id: values.patientId, name: values.patientName } : null
          }
          onSelect={(id, name) => {
            set("patientId", id);
            set("patientName", name);
          }}
        />
      </Field>

      <Field label={t("dentist")}>
        <select
          value={values.dentistId}
          onChange={(e) => set("dentistId", e.target.value)}
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
        >
          <option value="">{t("anyDentist")}</option>
          {dentists.map((d) => (
            <option key={d.id} value={d.id}>
              Dr {d.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("duration")} required>
          <select
            value={values.durationMin}
            onChange={(e) => set("durationMin", Number(e.target.value))}
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
          >
            {[15, 30, 45, 60, 90, 120].map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("timePref")}>
          <select
            value={values.timePreference}
            onChange={(e) => set("timePreference", e.target.value as WaitlistTimePreference)}
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
          >
            <option value="ANY">{t("anyTime")}</option>
            <option value="MORNING">{t("morning")}</option>
            <option value="AFTERNOON">{t("afternoon")}</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("notBefore")}>
          <Input
            type="date"
            value={values.notBefore}
            onChange={(e) => set("notBefore", e.target.value)}
          />
        </Field>
        <Field label={t("notAfter")}>
          <Input
            type="date"
            value={values.notAfter}
            onChange={(e) => set("notAfter", e.target.value)}
          />
        </Field>
      </div>

      <Field label={t("reason")}>
        <Input
          value={values.reason}
          onChange={(e) => set("reason", e.target.value)}
          placeholder={t("reasonPlaceholder")}
        />
      </Field>

      <div className="border-border/60 bg-card/95 -mx-6 -mb-6 flex items-center justify-end gap-2 border-t px-6 py-3 backdrop-blur">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-foreground mb-1.5 block text-sm font-medium">
        {label}
        {required && <span className="text-destructive ms-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
