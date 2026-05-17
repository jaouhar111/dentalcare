import { getTranslations } from "next-intl/server";
import { InstallmentStatus, PaymentPlanStatus } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { listPaymentPlansForPatient } from "@/server/actions/payment-plans";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
import type { Locale } from "@/i18n/routing";

/**
 * Lists every payment plan attached to this patient (active + closed). Each
 * card links to the underlying invoice where the schedule + per-installment
 * actions live. Closed plans are shown for history but visually muted.
 */
export async function PlansTab({
  patientId,
  locale,
}: {
  patientId: string;
  locale: Locale;
}) {
  const t = await getTranslations("Invoices.plan");
  const tInv = await getTranslations("Invoices");

  const result = await listPaymentPlansForPatient(patientId);
  if (!result.ok) {
    return (
      <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
        {result.error.message}
      </div>
    );
  }
  const plans = result.data;

  if (plans.length === 0) {
    return (
      <div className="bg-muted/30 border-border/60 rounded-lg border border-dashed py-16 text-center">
        <p className="text-foreground text-base font-medium">{t("noPlan")}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {/* Reuse existing string — plans are created from an invoice page. */}
          {tInv("emptyDesc")}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {plans.map((plan) => {
        const isActive = plan.status === PaymentPlanStatus.ACTIVE;
        const paid = plan.installments
          .filter((i) => i.status === InstallmentStatus.PAID)
          .reduce((s, i) => s + i.amount, 0);
        const paidCount = plan.installments.filter(
          (i) => i.status === InstallmentStatus.PAID,
        ).length;
        const pct =
          plan.totalAmount > 0 ? Math.min(100, (paid / plan.totalAmount) * 100) : 0;
        return (
          <li
            key={plan.id}
            className={`bg-card border-border/60 rounded-xl border p-4 ${
              isActive ? "" : "opacity-70"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/invoices/${plan.invoiceId}` as never}
                    className="text-foreground hover:text-primary text-sm font-medium"
                  >
                    {t("title")}
                  </Link>
                  {plan.status === PaymentPlanStatus.CANCELLED && (
                    <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                      {t("cancelled")}
                    </span>
                  )}
                  {plan.status === PaymentPlanStatus.COMPLETED && (
                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {t("completed")}
                    </span>
                  )}
                  {plan.overdueCount > 0 && isActive && (
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                      {t("overdueChip", { count: plan.overdueCount })}
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground num mt-0.5 text-xs">
                  {t("subtitle", {
                    count: plan.installmentsCount,
                    date: formatDateShort(plan.createdAt, locale),
                  })}
                  {" · "}
                  <span className="num">
                    {paidCount}/{plan.installmentsCount}
                  </span>{" "}
                  payées
                </div>
              </div>
              <div className="text-end">
                <div className="num text-foreground font-bold">
                  {formatCurrency(plan.totalAmount, locale)}
                </div>
                {plan.remainingAmount > 0 ? (
                  <div className="num text-rose-700 text-xs">
                    {formatCurrency(plan.remainingAmount, locale)}{" "}
                    {t("remainingOnPlan").toLowerCase()}
                  </div>
                ) : (
                  <div className="text-xs text-emerald-700">✓</div>
                )}
              </div>
            </div>
            <div className="bg-muted mt-3 h-2 w-full overflow-hidden rounded-full">
              <div
                className={`h-2 rounded-full transition-all ${
                  plan.status === PaymentPlanStatus.CANCELLED
                    ? "bg-rose-300"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${pct.toFixed(1)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
