"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ToothSurface, TreatmentApplicationStatus } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/confirm-dialog";
import {
  createApplication,
  deleteApplication,
} from "@/server/actions/treatments";
import type {
  ApplicationListItem,
  CatalogItemListItem,
} from "@/server/actions/treatments-types";
import { formatCurrency } from "@/lib/utils/format";
import type { Locale } from "@/i18n/routing";

/**
 * "Traitements de la séance" section rendered under the appointment edit form.
 *
 * Lists every {@link ApplicationListItem} already attached to this appointment
 * with delete affordance, plus a quick add form (catalog → tooth/surfaces →
 * price → discount). The total at the bottom rolls up `lineTotal` (DB-trusted,
 * not recomputed in the browser) so the receptionist can quote it to the
 * patient before issuing an invoice in Phase 9.
 */
export function SessionTreatments({
  appointmentId,
  patientId,
  dentistId,
  applications,
  catalog,
  canManage,
  locale,
}: {
  appointmentId: string;
  patientId: string;
  /// The dentist assigned to this RDV — pre-selected when adding a treatment.
  dentistId: string;
  applications: ApplicationListItem[];
  catalog: CatalogItemListItem[];
  canManage: boolean;
  locale: Locale;
}) {
  const t = useTranslations("Session");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const total = useMemo(
    () => applications.reduce((s, a) => s + a.lineTotal, 0),
    [applications],
  );

  async function onDelete(id: string) {
    const ok = await confirm({
      title: t("delete"),
      description: t("deleteConfirm"),
      confirmLabel: t("delete"),
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteApplication(id);
      if (!res.ok) {
        toast.error(tToast("error"), { description: tToast("errorDesc") });
        return;
      }
      toast.success(t("toast.deleted"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {applications.length === 0 ? (
        <p className="text-muted-foreground text-sm italic">{t("empty")}</p>
      ) : (
        <ul className="bg-card border-border/60 divide-border/60 divide-y overflow-hidden rounded-lg border">
          {applications.map((a) => (
            <li key={a.id} className="p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: a.catalogColor }}
                      aria-hidden
                    />
                    <span className="text-foreground font-medium">{a.catalogName}</span>
                    <span className="num text-muted-foreground font-mono text-xs">
                      {a.catalogCode}
                    </span>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    {a.toothNumber !== null && (
                      <>
                        <span className="num">
                          {t("tooth")} {a.toothNumber}
                        </span>
                        {a.surfaces.length > 0 && (
                          <>
                            {" · "}
                            {a.surfaces.map((s) => t(`surface.${s}`)).join(", ")}
                          </>
                        )}
                      </>
                    )}
                    {a.toothNumber === null && t("noTooth")}
                  </div>
                  {a.notes && (
                    <p className="text-foreground/80 mt-1 text-xs italic">{a.notes}</p>
                  )}
                </div>
                <div className="text-end">
                  <div className="num text-foreground font-semibold">
                    {formatCurrency(a.lineTotal, locale)}
                  </div>
                  {(a.discountPct !== null || a.discountAmount !== null) && (
                    <div className="text-muted-foreground num text-xs line-through">
                      {formatCurrency(a.unitPrice, locale)}
                    </div>
                  )}
                  {canManage && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onDelete(a.id)}
                      disabled={isPending}
                      className="text-muted-foreground hover:text-destructive mt-1 h-6 px-2 text-xs"
                    >
                      {t("delete")}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {applications.length > 0 && (
        <div className="bg-muted/30 border-border/60 flex items-center justify-between rounded-lg border px-4 py-2 text-sm">
          <span className="text-muted-foreground font-medium">{t("total")}</span>
          <span className="num text-foreground text-base font-bold">
            {formatCurrency(total, locale)}
          </span>
        </div>
      )}

      {canManage && (
        <div>
          <Button type="button" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
            <svg
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t("addTreatment")}
          </Button>

          <AddApplicationDialog
            open={open}
            onOpenChange={setOpen}
            appointmentId={appointmentId}
            patientId={patientId}
            dentistId={dentistId}
            catalog={catalog}
            onDone={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: TreatmentApplicationStatus }) {
  const t = useTranslations("Session.status");
  const tone =
    status === TreatmentApplicationStatus.COMPLETED
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
      : status === TreatmentApplicationStatus.IN_PROGRESS
        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
        : status === TreatmentApplicationStatus.CANCELLED
          ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
          : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium ${tone}`}
    >
      {t(status)}
    </span>
  );
}

// ─── Add dialog ─────────────────────────────────────────────────────────────

const SURFACES = Object.values(ToothSurface);
const STATUSES = Object.values(TreatmentApplicationStatus);
type DiscountMode = "none" | "pct" | "fixed";

function AddApplicationDialog({
  open,
  onOpenChange,
  appointmentId,
  patientId,
  dentistId,
  catalog,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  appointmentId: string;
  patientId: string;
  dentistId: string;
  catalog: CatalogItemListItem[];
  onDone: () => void;
}) {
  const t = useTranslations("Session");
  const tToast = useTranslations("Toast");
  const [isPending, startTransition] = useTransition();

  const [catalogItemId, setCatalogItemId] = useState(catalog[0]?.id ?? "");
  const selected = catalog.find((c) => c.id === catalogItemId);
  const [tooth, setTooth] = useState("");
  const [surfaces, setSurfaces] = useState<Set<ToothSurface>>(new Set());
  const [status, setStatus] = useState<TreatmentApplicationStatus>(
    TreatmentApplicationStatus.PLANNED,
  );
  const [unitPrice, setUnitPrice] = useState(String(selected?.defaultPrice ?? "0"));
  const [discountMode, setDiscountMode] = useState<DiscountMode>("none");
  const [discountValue, setDiscountValue] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    const first = catalog[0];
    setCatalogItemId(first?.id ?? "");
    setUnitPrice(String(first?.defaultPrice ?? 0));
    setTooth("");
    setSurfaces(new Set());
    setStatus(TreatmentApplicationStatus.PLANNED);
    setDiscountMode("none");
    setDiscountValue("");
    setNotes("");
  }

  function onCatalogChange(id: string) {
    setCatalogItemId(id);
    const item = catalog.find((c) => c.id === id);
    if (item) setUnitPrice(String(item.defaultPrice));
  }

  function toggleSurface(s: ToothSurface) {
    setSurfaces((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const toothNumber = tooth ? Number(tooth) : undefined;
      const discountPct =
        discountMode === "pct" && discountValue ? Number(discountValue) : undefined;
      const discountAmount =
        discountMode === "fixed" && discountValue ? Number(discountValue) : undefined;

      const res = await createApplication({
        patientId,
        appointmentId,
        dentistId,
        catalogItemId,
        toothNumber,
        surfaces: Array.from(surfaces),
        status,
        unitPrice: Number(unitPrice),
        discountPct,
        discountAmount,
        notes: notes || undefined,
      });
      if (!res.ok) {
        const errCode = res.error.code;
        const known = [
          "TOOTH_REQUIRED",
          "INVALID_TOOTH",
          "DISCOUNT_EXCLUSIVE",
        ] as const;
        const msg = (known as readonly string[]).includes(errCode)
          ? t(`errors.${errCode as "TOOTH_REQUIRED"}`)
          : res.error.message;
        toast.error(tToast("error"), { description: msg });
        return;
      }
      toast.success(t("toast.added"));
      reset();
      onDone();
    });
  }

  const showToothField = selected?.requiresTooth ?? true;

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("addTreatment")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-foreground mb-1 block text-xs font-medium">
              {t("form.catalog")} *
            </label>
            <select
              value={catalogItemId}
              onChange={(e) => onCatalogChange(e.target.value)}
              required
              disabled={isPending}
              className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
            >
              {catalog.length === 0 && <option value="">{t("form.catalogPlaceholder")}</option>}
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name} ({Number(c.defaultPrice).toFixed(2)} DH)
                </option>
              ))}
            </select>
          </div>

          {showToothField && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.tooth")}{" "}
                  {selected?.requiresTooth ? <span className="text-destructive">*</span> : null}
                </label>
                <input
                  type="number"
                  min="11"
                  max="48"
                  step="1"
                  value={tooth}
                  onChange={(e) => setTooth(e.target.value)}
                  required={selected?.requiresTooth}
                  placeholder="26"
                  disabled={isPending}
                  className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                />
                <p className="text-muted-foreground mt-1 text-xs">{t("form.toothHint")}</p>
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.surfaces")}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SURFACES.map((s) => {
                    const active = surfaces.has(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSurface(s)}
                        disabled={isPending}
                        className={`rounded-md border px-2 py-1 text-xs transition ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-input text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {t(`surface.${s}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                {t("form.unitPrice")} *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                required
                disabled={isPending}
                className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                {t("form.status")}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TreatmentApplicationStatus)}
                disabled={isPending}
                className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-foreground mb-1 block text-xs font-medium">
              {t("form.discountType")}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {(["none", "pct", "fixed"] as DiscountMode[]).map((m) => (
                <label
                  key={m}
                  className="border-input has-checked:bg-primary/10 has-checked:border-primary/40 has-checked:text-primary flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                >
                  <input
                    type="radio"
                    name="discountMode"
                    value={m}
                    checked={discountMode === m}
                    onChange={() => setDiscountMode(m)}
                    className="sr-only"
                    disabled={isPending}
                  />
                  {t(`form.discount${m === "none" ? "None" : m === "pct" ? "Pct" : "Fixed"}`)}
                </label>
              ))}
              {discountMode !== "none" && (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={discountMode === "pct" ? "100" : undefined}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountMode === "pct" ? "10" : "50"}
                  disabled={isPending}
                  className="border-input bg-background num w-24 rounded-md border px-2 py-1 text-xs shadow-xs disabled:opacity-50"
                />
              )}
              {discountMode === "pct" && <span className="text-muted-foreground text-xs">%</span>}
              {discountMode === "fixed" && (
                <span className="text-muted-foreground text-xs">DH</span>
              )}
            </div>
          </div>

          <div>
            <label className="text-foreground mb-1 block text-xs font-medium">
              {t("form.notes")}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={1000}
              disabled={isPending}
              className="border-input bg-background w-full resize-y rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t("form.cancel")}
            </Button>
            <Button type="submit" disabled={isPending || !catalogItemId}>
              {isPending ? t("form.submitting") : t("form.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
