"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addAbsence, removeAbsence } from "@/server/actions/dentists";

export interface AbsenceItem {
  id: string;
  startAt: Date;
  endAt: Date;
  reason: string | null;
}

export function AbsencesEditor({
  dentistId,
  initial,
}: {
  dentistId: string;
  initial: AbsenceItem[];
}) {
  const t = useTranslations("Absences");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function onAdd() {
    setFormError(null);
    if (!start || !end) {
      setFormError(t("errors.RANGE_INVERTED"));
      return;
    }
    if (new Date(start) >= new Date(end)) {
      setFormError(t("errors.RANGE_INVERTED"));
      return;
    }
    startTransition(async () => {
      const res = await addAbsence({
        dentistId,
        startAt: new Date(start).toISOString(),
        endAt: new Date(end).toISOString(),
        reason: reason || undefined,
      });
      if (!res.ok) {
        toast.error(tToast("error"), { description: tToast("errorDesc") });
        return;
      }
      toast.success(tToast("absenceAdded"));
      setStart("");
      setEnd("");
      setReason("");
      router.refresh();
    });
  }

  function onRemove(id: string) {
    startTransition(async () => {
      const res = await removeAbsence(id);
      if (!res.ok) {
        toast.error(tToast("error"), { description: tToast("errorDesc") });
        return;
      }
      toast.success(tToast("absenceRemoved"));
      router.refresh();
    });
  }

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold tracking-wider uppercase">{t("title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <div className="bg-card border-border/60 rounded-lg border p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <Field label={t("fields.startAt")}>
            <Input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="num"
            />
          </Field>
          <Field label={t("fields.endAt")}>
            <Input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="num"
            />
          </Field>
          <Field label={t("fields.reason")}>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("fields.reasonPlaceholder")}
            />
          </Field>
          <div className="self-end">
            <Button type="button" onClick={onAdd} disabled={isPending}>
              + {t("add")}
            </Button>
          </div>
        </div>
        {formError && (
          <div
            role="alert"
            className="bg-destructive/10 text-destructive mt-3 rounded-md p-2 text-sm"
          >
            {formError}
          </div>
        )}
      </div>

      {initial.length === 0 ? (
        <div className="text-muted-foreground border-border/60 rounded-lg border border-dashed py-10 text-center text-sm">
          {t("empty")}
        </div>
      ) : (
        <ul className="border-border/60 divide-border/60 bg-card divide-y rounded-lg border">
          {initial.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div>
                <div className="num text-sm font-medium">
                  {fmt(a.startAt)} → {fmt(a.endAt)}
                </div>
                {a.reason && <div className="text-muted-foreground mt-0.5 text-xs">{a.reason}</div>}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => onRemove(a.id)}
                disabled={isPending}
              >
                {t("remove")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-foreground mb-1.5 block text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}
