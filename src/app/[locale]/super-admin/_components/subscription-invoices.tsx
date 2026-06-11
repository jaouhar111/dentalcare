"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  issueSubscriptionInvoice,
  markSubscriptionInvoicePaid,
} from "@/server/actions/super-admin-billing";
import type { SubscriptionInvoiceRow } from "@/server/actions/super-admin-billing-types";

const PLAN_LABEL: Record<string, string> = {
  STARTER: "Starter",
  PRO: "Pro",
  CABINET_PLUS: "Cabinet+",
};

/** Subscription invoices ledger for a cabinet (issue + mark paid). */
export function SubscriptionInvoices({
  clinicId,
  invoices,
  locale,
}: {
  clinicId: string;
  invoices: SubscriptionInvoiceRow[];
  locale: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const madFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

  function issue() {
    startTransition(async () => {
      const res = await issueSubscriptionInvoice({ clinicId });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Facture émise.");
      router.refresh();
    });
  }

  function pay(id: string) {
    startTransition(async () => {
      const res = await markSubscriptionInvoicePaid({ id });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Facture marquée payée.");
      router.refresh();
    });
  }

  return (
    <section className="apple-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="apple-kpi-label">Factures d&apos;abonnement</div>
        <Button
          size="sm"
          onClick={issue}
          disabled={isPending}
          className="h-7 text-[12px]"
        >
          Émettre une facture
        </Button>
      </div>

      {invoices.length === 0 ? (
        <p className="text-muted-foreground text-[13px]">
          Aucune facture d&apos;abonnement émise pour ce cabinet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-muted-foreground border-border/60 border-b text-[10px] font-bold tracking-wider uppercase">
                <th className="py-2 pr-3">Émise le</th>
                <th className="py-2 pr-3">Plan</th>
                <th className="py-2 pr-3 text-end">Montant</th>
                <th className="py-2 pr-3">Statut</th>
                <th className="py-2 pr-3 text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-border/40 border-b last:border-0">
                  <td className="num py-2 pr-3">{dateFmt.format(inv.issuedAt)}</td>
                  <td className="py-2 pr-3">{PLAN_LABEL[inv.plan] ?? inv.plan}</td>
                  <td className="num py-2 pr-3 text-end font-medium">
                    {madFmt.format(inv.amount)} MAD / {inv.period}
                  </td>
                  <td className="py-2 pr-3">
                    {inv.status === "PAID" ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                        Payée{inv.paidAt ? ` · ${dateFmt.format(inv.paidAt)}` : ""}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        Émise
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-end">
                    {inv.status === "ISSUED" ? (
                      <button
                        type="button"
                        onClick={() => pay(inv.id)}
                        disabled={isPending}
                        className="text-primary ring-primary/30 hover:bg-primary/5 rounded-md px-2 py-1 text-[11px] font-medium ring-1 transition disabled:opacity-50"
                      >
                        Marquer payée
                      </button>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
