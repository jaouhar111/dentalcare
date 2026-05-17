import { getTranslations } from "next-intl/server";
import { InvoiceStatus } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { listInvoices } from "@/server/actions/invoices";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
import type { Locale } from "@/i18n/routing";

/**
 * "Factures" tab on the patient detail page. Lists every invoice attached to
 * this patient — drafts included — with quick navigation to the detail view.
 * Roll-up totals at the top give a glance: lifetime billed / paid / due.
 */
export async function InvoicesTab({
  patientId,
  locale,
}: {
  patientId: string;
  locale: Locale;
}) {
  const t = await getTranslations("Invoices");

  const result = await listInvoices({
    patientId,
    status: "all",
    query: "",
    page: 1,
    pageSize: 50,
  });
  if (!result.ok) {
    return (
      <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
        {result.error.message}
      </div>
    );
  }
  const items = result.data.items;
  const totals = items.reduce(
    (a, i) => {
      if (i.status === InvoiceStatus.VOID) return a;
      return {
        billed: a.billed + i.total,
        paid: a.paid + i.paid,
        remaining: a.remaining + i.remaining,
      };
    },
    { billed: 0, paid: 0, remaining: 0 },
  );

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <div className="bg-muted/30 border-border/60 rounded-lg border border-dashed py-16 text-center">
          <p className="text-foreground text-base font-medium">{t("empty")}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t("emptyDesc")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="bg-muted/30 border-border/60 rounded-lg border p-3">
              <div className="text-muted-foreground text-xs uppercase tracking-wider">
                {t("totals.total")}
              </div>
              <div className="num text-foreground mt-0.5 text-lg font-bold">
                {formatCurrency(totals.billed, locale)}
              </div>
            </div>
            <div className="bg-emerald-50/40 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900 rounded-lg border p-3">
              <div className="text-emerald-700 dark:text-emerald-300 text-xs uppercase tracking-wider">
                {t("totals.totalPaid")}
              </div>
              <div className="num mt-0.5 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                {formatCurrency(totals.paid, locale)}
              </div>
            </div>
            <div className="bg-rose-50/40 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900 rounded-lg border p-3">
              <div className="text-rose-700 dark:text-rose-300 text-xs uppercase tracking-wider">
                {t("totals.remaining")}
              </div>
              <div className="num mt-0.5 text-lg font-bold text-rose-700 dark:text-rose-300">
                {formatCurrency(totals.remaining, locale)}
              </div>
            </div>
          </div>

          <ul className="bg-card border-border/60 divide-border/60 divide-y overflow-hidden rounded-lg border">
            {items.map((i) => (
              <li key={i.id} className="hover:bg-muted/30">
                <Link
                  href={`/invoices/${i.id}` as never}
                  className="flex items-center justify-between gap-3 p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="num text-foreground font-mono text-xs font-semibold">
                        {i.number ?? `· ${i.id.slice(-6)}`}
                      </span>
                      <span className="rounded-full border px-1.5 py-0 text-[10px] font-medium">
                        {t(`status.${i.status}`)}
                      </span>
                      {i.isOverdue && (
                        <span className="text-xs text-rose-700">⚠ {t("overdue")}</span>
                      )}
                    </div>
                    <div className="text-muted-foreground num mt-0.5 text-xs">
                      {i.emittedAt
                        ? formatDateShort(i.emittedAt, locale)
                        : formatDateShort(i.createdAt, locale)}
                      {i.dueDate && i.remaining > 0 && (
                        <>
                          {" · "}
                          {t("doc.dueDate")} {formatDateShort(i.dueDate, locale)}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="num text-foreground font-semibold">
                      {formatCurrency(i.total, locale)}
                    </div>
                    {i.remaining > 0 ? (
                      <div className="num text-rose-700 text-xs">
                        {formatCurrency(i.remaining, locale)}
                      </div>
                    ) : (
                      <div className="text-xs text-emerald-700">✓</div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
