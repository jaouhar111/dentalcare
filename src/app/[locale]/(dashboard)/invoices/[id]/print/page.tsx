import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getInvoice } from "@/server/actions/invoices";
import { isRtl } from "@/i18n/routing";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { formatMoroccanPhone } from "@/lib/utils/phone";
import { PrintButtonInner } from "../../../prescriptions/[id]/print-button";
import { ShareWhatsAppButton } from "../../../prescriptions/[id]/share-button";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

/**
 * Bilingual print/preview page for an emitted invoice. Renders the same A4
 * layout for FR/EN/AR (RTL automatic when locale = ar). Reuses the print
 * stylesheet from globals.css that hides the dashboard chrome.
 */
export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const result = await getInvoice(id);
  if (!result.ok) notFound();
  const inv = result.data;

  // Refuse to render a DRAFT — printing a draft would mislead the patient.
  if (inv.status === "DRAFT") notFound();

  const docLocale = locale as Locale;
  const t = await getTranslations("Invoices");
  const tDoc = await getTranslations("Invoices.doc");
  const dir = isRtl(docLocale) ? "rtl" : "ltr";

  const dateFmt = (d: Date) =>
    formatDate(d, docLocale, { day: "numeric", month: "long", year: "numeric" });

  const shareTitle = `${tDoc("title")} ${inv.number ?? ""} — ${inv.patientName}`;

  return (
    <div className="bg-muted/30 min-h-screen py-8 print:bg-white print:py-0">
      {/* ─── Toolbar (hidden when printing) ─── */}
      <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between px-4 print:hidden">
        <Link
          href={`/invoices/${inv.id}` as never}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
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
          {inv.number ?? t("title")}
        </Link>
        <div className="flex items-center gap-2">
          <ShareWhatsAppButton
            phone={inv.patientPhone}
            title={shareTitle}
            shareEndpoint={`/api/invoices/${inv.id}/share`}
            label={t("actions.shareWhatsApp")}
          />
          <PrintButtonInner label={t("actions.print")} />
        </div>
      </div>

      {/* ─── Document ─── */}
      <article
        dir={dir}
        lang={docLocale}
        className="mx-auto max-w-4xl bg-white p-10 shadow-sm print:max-w-none print:p-12 print:shadow-none"
        style={{ minHeight: "29.7cm" }}
      >
        {/* Header */}
        <header className="border-b-2 border-slate-300 pb-4">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-3">
              {inv.clinicLogoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={inv.clinicLogoUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 object-contain"
                />
              )}
              <div>
              <div className="text-2xl font-bold tracking-tight text-slate-900">
                {inv.clinicName}
              </div>
              {inv.clinicAddress && (
                <div className="mt-0.5 text-sm text-slate-600">{inv.clinicAddress}</div>
              )}
              {inv.clinicPhone && (
                <div className="num mt-0.5 text-sm text-slate-600">
                  {formatMoroccanPhone(inv.clinicPhone)}
                </div>
              )}
              {inv.clinicVatNumber && (
                <div className="num text-xs text-slate-500">N° TVA {inv.clinicVatNumber}</div>
              )}
              </div>
            </div>
            <div className="text-end">
              <div className="text-xs font-medium tracking-widest text-cyan-700 uppercase">
                {tDoc("title")}
              </div>
              <div className="num mt-1 text-xl font-bold text-slate-900">{inv.number ?? "—"}</div>
              {inv.emittedAt && (
                <div className="num mt-2 text-xs text-slate-500">
                  {tDoc("emittedAt")} {dateFmt(inv.emittedAt)}
                </div>
              )}
              {inv.dueDate && (
                <div className="num text-xs text-slate-500">
                  {tDoc("dueDate")} {dateFmt(inv.dueDate)}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Patient block */}
        <section className="mt-6 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div>
            <div className="text-xs font-medium tracking-wider text-slate-500 uppercase">
              {tDoc("patient")}
            </div>
            <div className="mt-1 text-base font-semibold text-slate-900">{inv.patientName}</div>
          </div>
          <div>
            <div className="text-xs font-medium tracking-wider text-slate-500 uppercase">
              {tDoc("dob")}
            </div>
            <div className="num mt-1 text-slate-700">{dateFmt(inv.patientDob)}</div>
          </div>
          {inv.patientCin && (
            <div>
              <div className="text-xs font-medium tracking-wider text-slate-500 uppercase">
                {tDoc("cin")}
              </div>
              <div className="num mt-1 text-slate-700">{inv.patientCin}</div>
            </div>
          )}
          <div>
            <div className="text-xs font-medium tracking-wider text-slate-500 uppercase">
              {tDoc("phone")}
            </div>
            <div className="num mt-1 text-slate-700">{formatMoroccanPhone(inv.patientPhone)}</div>
          </div>
        </section>

        {/* Lines */}
        <section className="mt-8">
          <table className="w-full text-sm">
            <thead className="border-b-2 border-slate-300">
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2 text-start font-semibold">{tDoc("lineDescription")}</th>
                <th className="py-2 text-end font-semibold">{tDoc("qty")}</th>
                <th className="py-2 text-end font-semibold">{tDoc("unitPrice")}</th>
                <th className="py-2 text-end font-semibold">{tDoc("lineTotal")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inv.lines.map((l) => (
                <tr key={l.id}>
                  <td className="py-3">
                    <div className="font-medium text-slate-900">{l.description}</div>
                    {l.toothNumber !== null && (
                      <div className="num text-xs text-slate-500">FDI {l.toothNumber}</div>
                    )}
                  </td>
                  <td className="num py-3 text-end text-slate-700">{l.quantity}</td>
                  <td className="num py-3 text-end text-slate-700">
                    {formatCurrency(l.unitPrice, docLocale)}
                  </td>
                  <td className="num py-3 text-end font-medium text-slate-900">
                    {formatCurrency(l.lineTotal, docLocale)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-300">
              <tr>
                <td colSpan={3} className="py-2 text-end text-sm text-slate-600">
                  {t("totals.subtotal")}
                </td>
                <td className="num py-2 text-end text-sm">{formatCurrency(inv.subtotal, docLocale)}</td>
              </tr>
              {inv.discountAmount > 0 && (
                <tr>
                  <td colSpan={3} className="py-2 text-end text-sm text-slate-600">
                    {t("totals.discount")}
                  </td>
                  <td className="num py-2 text-end text-sm text-rose-700">
                    − {formatCurrency(inv.discountAmount, docLocale)}
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan={3} className="py-2 text-end text-xs text-slate-500">
                  {tDoc("vatNote")}
                </td>
                <td className="num py-2 text-end text-xs text-slate-500">0,00</td>
              </tr>
              <tr className="border-t-2 border-slate-400">
                <td colSpan={3} className="py-3 text-end font-bold">
                  {t("totals.total")}
                </td>
                <td className="num py-3 text-end text-xl font-bold text-cyan-700">
                  {formatCurrency(inv.total, docLocale)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* Payment status */}
        {inv.paid > 0 && (
          <section className="mt-6 rounded-md bg-emerald-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-emerald-800">{t("totals.totalPaid")}</span>
              <span className="num font-bold text-emerald-700">
                {formatCurrency(inv.paid, docLocale)}
              </span>
            </div>
            {inv.remaining > 0 && (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="font-medium text-rose-800">{t("totals.remaining")}</span>
                <span className="num font-bold text-rose-700">
                  {formatCurrency(inv.remaining, docLocale)}
                </span>
              </div>
            )}
          </section>
        )}

        {/* Notes */}
        {inv.notes && (
          <section className="mt-6 rounded-md border-s-4 border-amber-300 bg-amber-50 p-4">
            <p className="text-sm whitespace-pre-wrap text-amber-900">{inv.notes}</p>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-12 text-end">
          <div className="mt-12 ms-auto inline-block w-64 border-t border-slate-300 pt-2 text-xs text-slate-500">
            {t("doc.footer")}
          </div>
        </footer>
      </article>
    </div>
  );
}
