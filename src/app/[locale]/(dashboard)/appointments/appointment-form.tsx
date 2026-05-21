"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  cancelAppointment,
  createAppointment,
  updateAppointment,
} from "@/server/actions/appointments";
import { APPOINTMENT_DURATIONS } from "@/server/schemas/appointment";
import { combineLocalDateTime } from "@/lib/utils/week";
import { PatientPicker } from "./patient-picker";

export interface AppointmentFormValues {
  id?: string;
  patientId: string;
  patientName: string;
  dentistId: string;
  /** yyyy-mm-dd */
  date: string;
  /** HH:mm */
  time: string;
  durationMin: number;
  reason: string;
  notes: string;
  /// Catalog item to attach as a PLANNED `TreatmentApplication` on create.
  /// Empty string = "no treatment yet". Ignored on edit (dentist manages
  /// treatments via the "Soins de la séance" section instead).
  catalogItemId: string;
}

interface DentistOption {
  id: string;
  name: string;
  color: string;
}

interface CatalogOption {
  id: string;
  code: string;
  name: string;
  color: string;
}

export function AppointmentForm({
  initial,
  dentists,
  catalog,
  lockedDentistId,
  onSuccess,
}: {
  initial: AppointmentFormValues;
  dentists: DentistOption[];
  /**
   * Active treatment catalog. Used to render the "Soin associé" combo on
   * the CREATE form — picking a code spawns a PLANNED `TreatmentApplication`
   * server-side, which later transitions to COMPLETED to fire a recall.
   * Pass `[]` on the edit page; the existing "Soins de la séance" section
   * manages treatments after creation.
   */
  catalog: CatalogOption[];
  /**
   * When set, the dentist field renders as a read-only chip instead of a
   * picker. Used for DENTIST-role users so they can only book on their own
   * agenda. Must match the user's dentistId server-side too — the form
   * trusts the caller to enforce this.
   */
  lockedDentistId?: string | null;
  onSuccess?: (
    id: string,
    action: "create" | "update",
    summary: { patient: string; dentist: string },
  ) => void;
}) {
  const t = useTranslations("AppointmentForm");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const isEdit = !!initial.id;

  const [values, setValues] = useState<AppointmentFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof AppointmentFormValues>(k: K, v: AppointmentFormValues[K]) {
    setValues((s) => ({ ...s, [k]: v }));
  }

  const err = (k: string) => errors[k]?.[0];

  function onSubmit() {
    setErrors({});
    setTopError(null);
    if (!values.patientId) {
      setErrors({ patientId: ["REQUIRED"] });
      return;
    }

    startTransition(async () => {
      const startAt = combineLocalDateTime(values.date, values.time);
      const payload = {
        patientId: values.patientId,
        // When locked, the dropdown is hidden so `values.dentistId` may be
        // stale if the locale switched mid-render — always trust the lock.
        dentistId: lockedDentistId ?? values.dentistId,
        startAt,
        durationMin: values.durationMin,
        reason: values.reason || undefined,
        notes: values.notes || undefined,
        // Catalog item is honoured only on create. On edit, treatments are
        // managed by the dedicated "Soins de la séance" section so this
        // form doesn't have to reconcile add/replace/remove semantics.
        catalogItemId: !isEdit && values.catalogItemId ? values.catalogItemId : undefined,
      };
      const res = isEdit
        ? await updateAppointment({ ...payload, id: initial.id! })
        : await createAppointment(payload);

      if (!res.ok) {
        const code = res.error.code as
          | "CONFLICT"
          | "OUT_OF_HOURS"
          | "DURING_ABSENCE"
          | "PATIENT_NOT_FOUND"
          | "DENTIST_NOT_FOUND"
          | "INVALID_INPUT"
          | "INVALID_DATE"
          | "INVALID_DURATION"
          | "_form";
        if (code === "CONFLICT" || code === "OUT_OF_HOURS" || code === "DURING_ABSENCE") {
          setTopError(t(`errors.${code}`));
        } else {
          const fields = res.error.fields ?? {};
          const normalized: Record<string, string[]> = {};
          for (const [k, v] of Object.entries(fields)) if (v) normalized[k] = v;
          setErrors(normalized);
        }
        toast.error(tToast("error"), { description: tToast("errorDesc") });
        return;
      }

      const dentistName = dentists.find((d) => d.id === values.dentistId)?.name ?? "";
      if (onSuccess) {
        onSuccess(res.data.id, isEdit ? "update" : "create", {
          patient: values.patientName,
          dentist: dentistName,
        });
        return;
      }
      toast.success(tToast(isEdit ? "appointmentUpdated" : "appointmentCreated"), {
        description: !isEdit
          ? tToast("appointmentCreatedDesc", { patient: values.patientName, dentist: dentistName })
          : undefined,
      });
      router.replace("/appointments" as never);
    });
  }

  function onCancelAppointment() {
    if (!initial.id) return;
    startTransition(async () => {
      const res = await cancelAppointment({ id: initial.id! });
      if (!res.ok) {
        toast.error(tToast("error"), { description: tToast("errorDesc") });
        return;
      }
      toast.success(tToast("appointmentCancelled"));
      router.replace("/appointments" as never);
      router.refresh();
    });
  }

  return (
    <form action={() => onSubmit()} className="space-y-5">
      {topError && (
        <div role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {topError}
        </div>
      )}

      <Field
        label={t("fields.patient")}
        required
        error={err("patientId") && t(`errors.${err("patientId")}`)}
      >
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

      <Field label={t("fields.dentist")} required>
        {lockedDentistId ? (
          <div className="border-input bg-muted/40 text-foreground flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <span
              aria-hidden
              className="inline-block size-2.5 rounded-full"
              style={{
                background: dentists.find((d) => d.id === lockedDentistId)?.color ?? "#0891B2",
              }}
            />
            <span className="font-medium">
              Dr {dentists.find((d) => d.id === lockedDentistId)?.name ?? "—"}
            </span>
            <input type="hidden" name="dentistId" value={lockedDentistId} />
          </div>
        ) : (
          <select
            value={values.dentistId}
            onChange={(e) => set("dentistId", e.target.value)}
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
          >
            {dentists.map((d) => (
              <option key={d.id} value={d.id}>
                Dr {d.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      {!isEdit && catalog.length > 0 && (
        <Field label="Soin prévu (déclenche le rappel)">
          <select
            value={values.catalogItemId}
            onChange={(e) => set("catalogItemId", e.target.value)}
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
          >
            <option value="">— Aucun pour l'instant —</option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground mt-1 text-xs">
            Une fois marqué « réalisé » depuis la page du RDV, un rappel sera créé
            automatiquement selon le type de soin (détartrage → 6 mois, extraction → 1 mois, etc.).
          </p>
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("fields.date")} required>
          <Input
            type="date"
            value={values.date}
            onChange={(e) => set("date", e.target.value)}
            required
          />
        </Field>
        <Field label={t("fields.time")} required>
          <Input
            type="time"
            value={values.time}
            onChange={(e) => set("time", e.target.value)}
            required
          />
        </Field>
        <Field label={t("fields.duration")} required>
          <select
            value={values.durationMin}
            onChange={(e) => set("durationMin", Number(e.target.value))}
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
          >
            {APPOINTMENT_DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label={t("fields.reason")}>
        <Input
          value={values.reason}
          onChange={(e) => set("reason", e.target.value)}
          placeholder={t("fields.reasonPlaceholder")}
        />
      </Field>

      <Field label={t("fields.notes")}>
        <textarea
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          placeholder={t("fields.notesPlaceholder")}
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
        />
      </Field>

      <div className="border-border/60 bg-card/95 -mx-6 -mb-6 flex items-center justify-between gap-2 border-t px-6 py-3 backdrop-blur">
        {isEdit ? (
          <Button
            type="button"
            variant="destructive"
            onClick={onCancelAppointment}
            disabled={isPending}
          >
            {t("cancelAppointment")}
          </Button>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? t("submitLoading") : t("submit")}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-foreground mb-1.5 block text-sm font-medium">
        {label}
        {required && <span className="text-destructive ms-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
    </div>
  );
}
