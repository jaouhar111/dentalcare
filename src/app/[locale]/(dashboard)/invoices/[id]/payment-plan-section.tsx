import { getTranslations } from "next-intl/server";
import { InstallmentStatus, PaymentMethod, PaymentPlanStatus } from "@prisma/client";
import { getPaymentPlanForInvoice } from "@/server/actions/payment-plans";
import { formatCurrency, formatDate, formatDateShort } from "@/lib/utils/format";
import { CreatePlanDialog } from "./create-plan-dialog";
import { CancelPlanButton } from "./cancel-plan-button";
import { PayInstallmentButton } from "./pay-installment-button";
import type { Locale } from "@/i18n/routing";

/**
 * Server-Component panel rendered below the invoice detail. Two states:
 *   - **No plan yet** → CTA to open the create-plan dialog.
 *   - **Plan exists** → schedule view with paid / upcoming / overdue rows and
 *     a footer summary (remaining + reminders hint).
 *
 * Visible only when the invoice is in EMITTED/PARTIAL state — the parent page
 * controls that gate.
 */
export async function PaymentPlanSection({
  invoiceId,
  remaining,
  showCreateCTA,
  locale,
}: {
  invoiceId: string;
  remaining: number;
  showCreateCTA: boolean;
  locale: Locale;
}) {
  const t = await getTranslations("Invoices.plan");
  const tMethod = await getTranslations("Invoices.method");

  const result = await getPaymentPlanForInvoice(invoiceId);
  if (!result.ok) return null;
  const plan = result.data;

  if (!plan) {
    if (!showCreateCTA || remaining <= 0) return null;
    return (
      <div className="bg-card border-border/60 mt-4 rounded-xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{t("title")}</h2>
            <p className="page-sub">{t("noPlan")}</p>
          </div>
          <CreatePlanDialog invoiceId={invoiceId} remaining={remaining} />
        </div>
      </div>
    );
  }

  const isActive = plan.status === PaymentPlanStatus.ACTIVE;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="bg-card border-border/60 mt-4 overflow-hidden rounded-xl border">
      <div className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
        <div>
          <h2 className="flex flex-wrap items-center gap-2 font-semibold">
            {t("title")}
            {plan.overdueCount > 0 && isActive && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                {t("overdueChip", { count: plan.overdueCount })}
              </span>
            )}
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
          </h2>
          <p className="text-muted-foreground num mt-0.5 text-xs">
            {t("subtitle", {
              count: plan.installmentsCount,
              date: formatDateShort(plan.createdAt, locale),
            })}
          </p>
        </div>
        {isActive && <CancelPlanButton id={plan.id} />}
      </div>

      <ul className="divide-border/60 divide-y">
        {plan.installments.map((inst) => {
          const isPaid = inst.status === InstallmentStatus.PAID;
          const isCancelled = inst.status === InstallmentStatus.CANCELLED;
          const isOverdue = inst.displayStatus === "OVERDUE";
          const lateBy =
            isOverdue
              ? Math.round((today.getTime() - inst.dueDate.getTime()) / 86_400_000)
              : 0;
          const rowTint = isPaid
            ? "bg-emerald-50/30 dark:bg-emerald-950/10"
            : isOverdue
              ? "bg-rose-50 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:ring-rose-900"
              : "";
          return (
            <li
              key={inst.id}
              className={`flex flex-wrap items-center gap-4 px-5 py-4 text-sm ${rowTint}`}
            >
              <Bullet status={inst.status} isOverdue={isOverdue} />
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <div className="text-muted-foreground text-xs">
                    {t("installment", { n: inst.sequence, total: plan.installmentsCount })}
                  </div>
                  <div className="num text-foreground font-medium">
                    {formatDate(inst.dueDate, locale, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">{t("amount")}</div>
                  <div className="num text-foreground font-medium">
                    {formatCurrency(inst.amount, locale)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">{t("status")}</div>
                  {isPaid && inst.paidAt ? (
                    <div className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      {t("paidVia", {
                        method: tMethod(PaymentMethod.CASH),
                        date: formatDateShort(inst.paidAt, locale),
                      })}
                    </div>
                  ) : isCancelled ? (
                    <div className="text-muted-foreground text-sm">{t("cancelledLine")}</div>
                  ) : isOverdue ? (
                    <div className="text-sm font-bold text-rose-700 dark:text-rose-300">
                      {t("lateBy", { days: lateBy })}
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-sm">{t("comingUp")}</div>
                  )}
                </div>
              </div>
              {isActive && !isPaid && !isCancelled && (
                <PayInstallmentButton
                  invoiceId={invoiceId}
                  installmentId={inst.id}
                  amount={inst.amount}
                />
              )}
            </li>
          );
        })}
      </ul>

      <div className="bg-muted/30 border-border/60 flex flex-wrap items-center justify-between gap-2 border-t px-5 py-4 text-sm">
        <div className="text-muted-foreground">
          {t("remainingOnPlan")} :{" "}
          <span className="num font-bold text-rose-700 dark:text-rose-300">
            {formatCurrency(plan.remainingAmount, locale)}
          </span>
        </div>
        <div className="text-muted-foreground text-xs">{t("remindersHint")}</div>
      </div>
    </div>
  );
}

function Bullet({ status, isOverdue }: { status: InstallmentStatus; isOverdue: boolean }) {
  if (status === InstallmentStatus.PAID) {
    return (
      <div className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-500 font-bold text-white">
        ✓
      </div>
    );
  }
  if (status === InstallmentStatus.CANCELLED) {
    return (
      <div className="text-muted-foreground border-border grid size-7 shrink-0 place-items-center rounded-full border-2 font-bold">
        ✕
      </div>
    );
  }
  if (isOverdue) {
    return (
      <div className="grid size-7 shrink-0 place-items-center rounded-full bg-rose-500 font-bold text-white">
        !
      </div>
    );
  }
  return (
    <div className="text-muted-foreground border-border grid size-7 shrink-0 place-items-center rounded-full border-2 font-bold">
      ○
    </div>
  );
}
