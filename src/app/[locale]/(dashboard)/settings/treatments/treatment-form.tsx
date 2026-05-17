"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createCatalogItem,
  updateCatalogItem,
} from "@/server/actions/treatments";
import type { CatalogItemListItem } from "@/server/actions/treatments-types";

export function TreatmentFormDialog(
  props: { mode: "create" } | { mode: "edit"; item: CatalogItemListItem },
) {
  const t = useTranslations("Treatments");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isEdit = props.mode === "edit";
  const item = isEdit ? props.item : null;

  const [code, setCode] = useState(item?.code ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(String(item?.defaultPrice ?? "300"));
  const [duration, setDuration] = useState(String(item?.defaultDurationMin ?? 30));
  const [requiresTooth, setRequiresTooth] = useState(item?.requiresTooth ?? false);
  const [color, setColor] = useState(item?.color ?? "#0891B2");
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 100));

  function reset() {
    if (isEdit && item) {
      setCode(item.code);
      setName(item.name);
      setDescription(item.description ?? "");
      setPrice(String(item.defaultPrice));
      setDuration(String(item.defaultDurationMin));
      setRequiresTooth(item.requiresTooth);
      setColor(item.color);
      setIsActive(item.isActive);
      setSortOrder(String(item.sortOrder));
    } else {
      setCode("");
      setName("");
      setDescription("");
      setPrice("300");
      setDuration("30");
      setRequiresTooth(false);
      setColor("#0891B2");
      setIsActive(true);
      setSortOrder("100");
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const payload = {
        code,
        name,
        description: description || undefined,
        defaultPrice: Number(price),
        defaultDurationMin: Number(duration),
        requiresTooth,
        color,
        isActive,
        sortOrder: Number(sortOrder),
      };
      const res = isEdit
        ? await updateCatalogItem({ ...payload, id: item!.id })
        : await createCatalogItem(payload);
      if (!res.ok) {
        const errCode = res.error.code;
        const known = ["DUPLICATE_CODE", "INVALID_CODE", "INVALID_COLOR"] as const;
        const msg = (known as readonly string[]).includes(errCode)
          ? t(`errors.${errCode as "DUPLICATE_CODE"}`)
          : res.error.message;
        toast.error(tToast("error"), { description: msg });
        return;
      }
      toast.success(isEdit ? t("toast.updated") : t("toast.created"));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {isEdit ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            reset();
            setOpen(true);
          }}
          className="h-8 px-2 text-xs"
        >
          {t("edit")}
        </Button>
      ) : (
        <Button type="button" onClick={() => setOpen(true)} className="gap-1.5">
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
          {t("add")}
        </Button>
      )}

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t(isEdit ? "form.titleEdit" : "form.titleCreate")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.code")} *
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                  maxLength={20}
                  pattern="[A-Za-z0-9-]+"
                  placeholder={t("form.codePlaceholder")}
                  disabled={isPending}
                  className="border-input bg-background num w-full rounded-lg border px-3 py-2 font-mono text-sm uppercase shadow-xs disabled:opacity-50"
                />
              </div>
              <div className="col-span-2">
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.name")} *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={120}
                  placeholder={t("form.namePlaceholder")}
                  disabled={isPending}
                  className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                {t("form.description")}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={500}
                disabled={isPending}
                className="border-input bg-background w-full resize-y rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.defaultPrice")} *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  disabled={isPending}
                  className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.defaultDuration")}
                </label>
                <input
                  type="number"
                  step="5"
                  min="5"
                  max="480"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  disabled={isPending}
                  className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.sortOrder")}
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  disabled={isPending}
                  className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.color")}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    disabled={isPending}
                    className="border-input h-9 w-12 cursor-pointer rounded-lg border disabled:opacity-50"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    pattern="#[0-9A-Fa-f]{6}"
                    maxLength={7}
                    disabled={isPending}
                    className="border-input bg-background num flex-1 rounded-lg border px-3 py-2 font-mono text-sm uppercase shadow-xs disabled:opacity-50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="hover:bg-muted/40 flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={requiresTooth}
                    onChange={(e) => setRequiresTooth(e.target.checked)}
                    disabled={isPending}
                    className="mt-0.5"
                  />
                  <span className="flex-1">
                    <div className="text-foreground font-medium">{t("form.requiresTooth")}</div>
                    <div className="text-muted-foreground text-xs">
                      {t("form.requiresToothHint")}
                    </div>
                  </span>
                </label>
                <label className="hover:bg-muted/40 flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    disabled={isPending}
                  />
                  <span className="text-foreground font-medium">{t("form.isActive")}</span>
                </label>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                {t("form.cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? t("form.submitting")
                  : isEdit
                    ? t("form.submitUpdate")
                    : t("form.submitCreate")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
