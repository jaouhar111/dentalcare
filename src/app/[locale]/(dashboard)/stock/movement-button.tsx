"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { StockMovementType } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { recordMovement } from "@/server/actions/stock";

const TYPES: StockMovementType[] = [
  StockMovementType.PURCHASE,
  StockMovementType.CONSUMPTION,
  StockMovementType.ADJUSTMENT,
  StockMovementType.RETURN,
];

function todayYmd(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Inline "+" / "−" affordance per row. Opens a small dialog to record any
 * movement type. The action layer auto-signs the quantity so the user always
 * types a positive integer.
 */
export function MovementButton({
  itemId,
  itemName,
  unit,
}: {
  itemId: string;
  itemName: string;
  unit: string;
}) {
  const t = useTranslations("Stock");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<StockMovementType>(StockMovementType.PURCHASE);
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [note, setNote] = useState("");
  const [recordedAt, setRecordedAt] = useState(todayYmd());
  const [isPending, startTransition] = useTransition();

  function reset() {
    setType(StockMovementType.PURCHASE);
    setQuantity("1");
    setUnitPrice("");
    setNote("");
    setRecordedAt(todayYmd());
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await recordMovement({
        itemId,
        type,
        quantity: Number(quantity),
        unitPrice: unitPrice ? Number(unitPrice) : undefined,
        note: note || undefined,
        recordedAt,
      });
      if (!res.ok) {
        const msg =
          res.error.code === "INSUFFICIENT_STOCK"
            ? t("errors.INSUFFICIENT_STOCK")
            : res.error.message;
        toast.error(tToast("error"), { description: msg });
        return;
      }
      toast.success(t("toast.movement"));
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="h-7 px-2 text-xs"
      >
        + {t("movement")}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("movementForm.title")}</DialogTitle>
            <p className="text-muted-foreground text-sm">{itemName}</p>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                {t("movementForm.type")} *
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {TYPES.map((ty) => (
                  <label
                    key={ty}
                    className="border-input has-checked:bg-primary/10 has-checked:border-primary/40 has-checked:text-primary flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs"
                  >
                    <input
                      type="radio"
                      name="movement-type"
                      value={ty}
                      checked={type === ty}
                      onChange={() => setType(ty)}
                      className="sr-only"
                      disabled={isPending}
                    />
                    {t(`type.${ty}`)}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("movementForm.quantity")} *
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                    disabled={isPending}
                    className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                  />
                  <span className="text-muted-foreground text-xs">{unit}</span>
                </div>
              </div>
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("movementForm.recordedAt")}
                </label>
                <input
                  type="date"
                  value={recordedAt}
                  onChange={(e) => setRecordedAt(e.target.value)}
                  max={todayYmd()}
                  disabled={isPending}
                  className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                />
              </div>
            </div>

            {type === StockMovementType.PURCHASE && (
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("movementForm.unitPrice")}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  disabled={isPending}
                  className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                />
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {t("movementForm.unitPriceHint")}
                </p>
              </div>
            )}

            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                {t("movementForm.note")}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder={t("movementForm.notePlaceholder")}
                disabled={isPending}
                className="border-input bg-background w-full resize-y rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                {t("movementForm.cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? t("movementForm.submitting") : t("movementForm.submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
