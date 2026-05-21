"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useConfirm } from "@/components/confirm-dialog";
import { deleteInvoice } from "@/server/actions/invoices";

/**
 * Hard-delete a DRAFT invoice. Shown only when status === "DRAFT"; for
 * any other status the user gets the void button instead (which preserves
 * the legal numbering chain).
 */
export function DeleteInvoiceButton({ id }: { id: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const ok = await confirm({
        title: "Supprimer ce brouillon ?",
        description:
          "Le brouillon de facture sera effacé définitivement. Cette action est irréversible.",
        confirmLabel: "Supprimer",
        variant: "destructive",
      });
      if (!ok) return;

      const res = await deleteInvoice(id);
      if (!res.ok) {
        toast.error("Suppression impossible", { description: res.error.message });
        return;
      }
      toast.success("Brouillon supprimé");
      router.replace("/invoices" as never);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
    >
      <svg
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79"
        />
      </svg>
      {isPending ? "…" : "Supprimer"}
    </button>
  );
}
