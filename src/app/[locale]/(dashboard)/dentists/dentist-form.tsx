"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createDentist, updateDentist } from "@/server/actions/dentists";

const PALETTE = [
  "#0891B2", // cyan-600 brand
  "#059669", // emerald-600
  "#8B5CF6", // violet-500
  "#F59E0B", // amber-500
  "#E11D48", // rose-600
  "#0EA5E9", // sky-500
  "#EC4899", // pink-500
  "#10B981", // emerald-500
];

export interface DentistFormValues {
  id?: string;
  firstName: string;
  lastName: string;
  specialty: string;
  phone: string;
  email: string;
  color: string;
}

export function DentistForm({
  initial,
  onSuccess,
}: {
  initial: DentistFormValues;
  onSuccess?: (id: string, action: "create" | "update", displayName: string) => void;
}) {
  const t = useTranslations("DentistForm");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const isEdit = !!initial.id;
  const [values, setValues] = useState<DentistFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof DentistFormValues>(k: K, v: DentistFormValues[K]) {
    setValues((s) => ({ ...s, [k]: v }));
  }
  const err = (k: string) => errors[k]?.[0];

  function onSubmit() {
    setErrors({});
    startTransition(async () => {
      const payload = {
        firstName: values.firstName,
        lastName: values.lastName,
        specialty: values.specialty || undefined,
        phone: values.phone || undefined,
        email: values.email || undefined,
        color: values.color,
      };
      const res = isEdit
        ? await updateDentist({ ...payload, id: initial.id! })
        : await createDentist(payload);

      if (!res.ok) {
        const fields = res.error.fields ?? { _form: [res.error.code] };
        const normalized: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(fields)) if (v) normalized[k] = v;
        setErrors(normalized);
        toast.error(tToast("error"), { description: tToast("errorDesc") });
        return;
      }

      const displayName = `${values.firstName} ${values.lastName}`.trim();
      if (onSuccess) {
        onSuccess(res.data.id, isEdit ? "update" : "create", displayName);
        return;
      }
      toast.success(tToast(isEdit ? "dentistUpdated" : "dentistCreated"), {
        description: tToast(isEdit ? "dentistUpdatedDesc" : "dentistCreatedDesc", {
          name: displayName,
        }),
      });
      router.replace(`/dentists/${res.data.id}` as never);
    });
  }

  return (
    <form action={() => onSubmit()} className="space-y-6">
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
        <Field label={t("fields.specialty")} help={t("fields.specialtyHelp")} colSpan={2}>
          <Input
            value={values.specialty}
            onChange={(e) => set("specialty", e.target.value)}
            placeholder="Orthodontiste, Implantologue, …"
          />
        </Field>
      </Section>

      <Section title={t("sections.contact")}>
        <Field label={t("fields.phone")} error={err("phone") && t(`errors.${err("phone")}`)}>
          <Input
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
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
      </Section>

      <Section title={t("sections.display")}>
        <Field
          label={t("fields.color")}
          help={t("fields.colorHelp")}
          error={err("color") && t(`errors.${err("color")}`)}
          colSpan={2}
        >
          <div className="flex flex-wrap items-center gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set("color", c)}
                aria-label={c}
                aria-pressed={values.color.toUpperCase() === c}
                className={`size-8 rounded-full ring-offset-2 transition ${
                  values.color.toUpperCase() === c
                    ? "ring-foreground ring-2"
                    : "hover:ring-foreground/30 hover:ring-2"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={values.color}
              onChange={(e) => set("color", e.target.value.toUpperCase())}
              className="border-input size-8 cursor-pointer rounded-full border bg-transparent"
              aria-label={t("fields.color")}
            />
            <span className="num text-muted-foreground ml-2 text-xs">{values.color}</span>
          </div>
        </Field>
      </Section>

      {errors._form && (
        <div role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {t("errors._form")}
        </div>
      )}

      <div className="border-border/60 bg-card/95 -mx-6 -mb-6 flex items-center justify-end gap-2 border-t px-6 py-3 backdrop-blur">
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
