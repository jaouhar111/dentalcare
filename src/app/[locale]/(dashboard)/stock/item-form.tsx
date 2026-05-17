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
  createStockItem,
  updateStockItem,
} from "@/server/actions/stock";

interface ItemForEdit {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  lowStockAt: number | null;
  expiresAt: Date | null;
  category: string | null;
  isActive: boolean;
}

export function StockItemFormDialog(
  props: { mode: "create" } | { mode: "edit"; item: ItemForEdit },
) {
  const t = useTranslations("Stock");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isEdit = props.mode === "edit";
  const item = isEdit ? props.item : null;

  const [code, setCode] = useState(item?.code ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "unité");
  const [category, setCategory] = useState(item?.category ?? "");
  const [lowStockAt, setLowStockAt] = useState(
    item?.lowStockAt !== null && item?.lowStockAt !== undefined ? String(item.lowStockAt) : "",
  );
  const [expiresAt, setExpiresAt] = useState(
    item?.expiresAt ? new Date(item.expiresAt).toISOString().slice(0, 10) : "",
  );
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [openingQuantity, setOpeningQuantity] = useState("");

  function reset() {
    if (isEdit && item) {
      setCode(item.code);
      setName(item.name);
      setDescription(item.description ?? "");
      setUnit(item.unit);
      setCategory(item.category ?? "");
      setLowStockAt(item.lowStockAt !== null ? String(item.lowStockAt) : "");
      setExpiresAt(item.expiresAt ? new Date(item.expiresAt).toISOString().slice(0, 10) : "");
      setIsActive(item.isActive);
    } else {
      setCode("");
      setName("");
      setDescription("");
      setUnit("unité");
      setCategory("");
      setLowStockAt("");
      setExpiresAt("");
      setIsActive(true);
      setOpeningQuantity("");
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const base = {
        code,
        name,
        description: description || undefined,
        unit,
        category: category || undefined,
        lowStockAt: lowStockAt ? Number(lowStockAt) : undefined,
        expiresAt: expiresAt || undefined,
        isActive,
      };
      const res = isEdit
        ? await updateStockItem({ ...base, id: item!.id })
        : await createStockItem({
            ...base,
            openingQuantity: openingQuantity ? Number(openingQuantity) : undefined,
          });
      if (!res.ok) {
        const known = ["DUPLICATE_CODE", "INVALID_CODE"] as const;
        const msg = (known as readonly string[]).includes(res.error.code)
          ? t(`errors.${res.error.code as "DUPLICATE_CODE"}`)
          : res.error.message;
        toast.error(tToast("error"), { description: msg });
        return;
      }
      toast.success(isEdit ? t("toast.updated") : t("toast.created"));
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {isEdit ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          {t("edit")}
        </Button>
      ) : (
        <Button type="button" onClick={() => setOpen(true)} className="gap-1.5">
          <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
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
          <form onSubmit={onSubmit} className="space-y-3">
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
                  maxLength={30}
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.unit")}
                </label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  maxLength={20}
                  placeholder={t("form.unitPlaceholder")}
                  disabled={isPending}
                  className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.category")}
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  maxLength={60}
                  placeholder={t("form.categoryPlaceholder")}
                  disabled={isPending}
                  className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.lowStockAt")}
                </label>
                <input
                  type="number"
                  min="0"
                  value={lowStockAt}
                  onChange={(e) => setLowStockAt(e.target.value)}
                  disabled={isPending}
                  className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                />
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {t("form.lowStockAtHint")}
                </p>
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.expiresAt")}
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  disabled={isPending}
                  className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
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

            {!isEdit && (
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.openingQuantity")}
                </label>
                <input
                  type="number"
                  min="0"
                  value={openingQuantity}
                  onChange={(e) => setOpeningQuantity(e.target.value)}
                  placeholder="0"
                  disabled={isPending}
                  className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                />
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {t("form.openingQuantityHint")}
                </p>
              </div>
            )}

            <label className="hover:bg-muted/40 flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={isPending}
              />
              <span className="text-foreground font-medium">{t("form.isActive")}</span>
            </label>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
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
