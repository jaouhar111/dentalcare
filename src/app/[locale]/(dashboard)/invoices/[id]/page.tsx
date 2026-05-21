import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { InvoiceStatus } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { getInvoice } from "@/server/actions/invoices";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
import { InvoiceLinesEditor } from "./lines-editor";
import { PaymentPanel, RecordPaymentButton } from "./payment-panel";
import { EmitButton } from "./emit-button";
import { VoidButton } from "./void-button";
import { DeleteInvoiceButton } from "./delete-button";
import { PrintInvoiceButton } from "./print-button";
import { SharePdfButton } from "./share-pdf-button";
import { PaymentPlanSection } from "./payment-plan-section";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Invoices");

  const result = await getInvoice(id);
  if (!result.ok) notFound();
  const inv = result.data;

  const isDraft = inv.status === InvoiceStatus.DRAFT;
  const isVoid = inv.status === InvoiceStatus.VOID;
  const isPaid = inv.status === InvoiceStatus.PAID;
  const payable =
    inv.status === InvoiceStatus.EMITTED || inv.status === InvoiceStatus.PARTIAL;
  const pct = inv.total > 0 ? Math.min(100, (inv.paid / inv.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <Link
        href={`/patients/${inv.patientId}` as never}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <svg
          className="size-4 rtl:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        {inv.patientName}
      </Link>

      {/* ─── Header ─── */}
      <div className="bg-card border-border/60 mb-4 rounded-xl border p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="num text-2xl font-bold tracking-tight">
                {inv.number ?? `Brouillon · ${inv.id.slice(-6)}`}
              </h1>
              <StatusBadge status={inv.status} />
              {inv.isOverdue && (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                  ⚠ {t("overdue")}
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              <Link
                href={`/patients/${inv.patientId}` as never}
                className="hover:text-primary"
              >
                {inv.patientName}
              </Link>
              {inv.patientCin && (
                <>
                  {" · CIN "}
                  <span className="num">{inv.patientCin}</span>
                </>
              )}
            </p>
            {inv.emittedAt && (
              <p className="text-muted-foreground num mt-1 text-xs">
                {t("doc.emittedAt")} {formatDateShort(inv.emittedAt, locale as Locale)}
                {inv.dueDate && (
                  <>
                    {" · "}
                    {t("doc.dueDate")} {formatDateShort(inv.dueDate, locale as Locale)}
                  </>
                )}
              </p>
            )}
            {isVoid && inv.voidedReason && (
              <p className="mt-2 text-xs text-rose-700 dark:text-rose-400">
                ✕ {inv.voidedReason}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isDraft && !isVoid && (
              <PrintInvoiceButton id={inv.id} label={t("actions.print")} />
            )}
            {!isDraft && !isVoid && (
              <SharePdfButton
                invoiceId={inv.id}
                patientPhone={inv.patientPhone}
                number={inv.number}
              />
            )}
            {payable && (
              <RecordPaymentButton
                invoiceId={inv.id}
                remaining={inv.remaining}
                label={t("actions.recordPayment")}
              />
            )}
            {isDraft && <EmitButton id={inv.id} hasLines={inv.lines.length > 0} />}
            {isDraft && <DeleteInvoiceButton id={inv.id} />}
            {!isVoid && !isPaid && !isDraft && (
              <VoidButton id={inv.id} disabled={inv.payments.length > 0 && isPaid} />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ─── Lines ─── */}
        <div className="bg-card border-border/60 overflow-hidden rounded-xl border lg:col-span-2">
          <div className="border-border/60 flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-semibold">{t("doc.lineDescription")}</h2>
          </div>
          <InvoiceLinesEditor
            invoiceId={inv.id}
            lines={inv.lines}
            editable={isDraft}
            locale={locale as Locale}
          />

          <div className="bg-muted/30 border-border/60 border-t px-5 py-3 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">{t("totals.subtotal")}</span>
              <span className="num">{formatCurrency(inv.subtotal, locale as Locale)}</span>
            </div>
            {inv.discountAmount > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">{t("totals.discount")}</span>
                <span className="num text-rose-700">
                  − {formatCurrency(inv.discountAmount, locale as Locale)}
                </span>
              </div>
            )}
            <div className="text-muted-foreground flex justify-between py-1 text-xs">
              <span>{t("totals.vatNote")}</span>
              <span className="num">0,00</span>
            </div>
            <div className="border-border/60 mt-2 flex items-center justify-between border-t pt-3 text-base font-bold">
              <span>{t("totals.total")}</span>
              <span className="text-primary num text-xl">
                {formatCurrency(inv.total, locale as Locale)}
              </span>
            </div>
          </div>
        </div>

        {/* ─── Right column ─── */}
        <div className="space-y-4">
          <div className="bg-card border-border/60 rounded-xl border p-5">
            <div className="text-muted-foreground mb-3 text-xs tracking-wider uppercase">
              {t("totals.totalPaid")}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("totals.total")}</span>
                <span className="num font-medium">
                  {formatCurrency(inv.total, locale as Locale)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("totals.totalPaid")}</span>
                <span className="num text-emerald-700 font-medium">
                  {formatCurrency(inv.paid, locale as Locale)}
                </span>
              </div>
              <div className="border-border/60 flex justify-between border-t pt-2">
                <span className="font-medium text-rose-700">{t("totals.remaining")}</span>
                <span className="num text-rose-700 font-bold">
                  {formatCurrency(inv.remaining, locale as Locale)}
                </span>
              </div>
            </div>
            <div className="bg-muted mt-3 h-2 w-full overflow-hidden rounded-full">
              <div
                className="h-2 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${pct.toFixed(1)}%` }}
              />
            </div>
            <div className="text-muted-foreground num mt-1 text-xs">{pct.toFixed(1)} %</div>
          </div>

          <PaymentPanel
            invoiceId={inv.id}
            payments={inv.payments}
            canDelete={!isVoid}
            locale={locale as Locale}
          />
        </div>
      </div>

      {inv.notes && (
        <div className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900 mt-4 rounded-xl border-s-4 p-4 text-sm">
          <div className="text-xs font-medium tracking-wider text-amber-800 uppercase dark:text-amber-300">
            {t("doc.lineDescription")}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-amber-900 dark:text-amber-200">
            {inv.notes}
          </p>
        </div>
      )}

      {/* ─── Payment plan ─── */}
      {!isDraft && !isVoid && (
        <PaymentPlanSection
          invoiceId={inv.id}
          remaining={inv.remaining}
          showCreateCTA={payable && !inv.hasPaymentPlan}
          locale={locale as Locale}
        />
      )}
    </div>
  );
}

async function StatusBadge({ status }: { status: InvoiceStatus }) {
  const t = await getTranslations("Invoices.status");
  const tone =
    status === InvoiceStatus.DRAFT
      ? "bg-muted text-muted-foreground border-border"
      : status === InvoiceStatus.EMITTED
        ? "bg-primary/10 text-primary border-primary/30"
        : status === InvoiceStatus.PARTIAL
          ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
          : status === InvoiceStatus.PAID
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
            : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${tone}`}>
      ● {t(status)}
    </span>
  );
}
