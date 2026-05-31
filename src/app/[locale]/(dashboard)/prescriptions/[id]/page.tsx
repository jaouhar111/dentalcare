import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getPrescription } from "@/server/actions/prescriptions";
import { isRtl } from "@/i18n/routing";
import { formatDate } from "@/lib/utils/format";
import { formatMoroccanPhone } from "@/lib/utils/phone";
import { ShareWhatsAppButton } from "./share-button";
import { PrintButtonInner } from "./print-button";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

/**
 * Read-only print/preview page for a prescription. Designed to render cleanly
 * on A5 paper: the user prints the document via the browser's native print
 * dialog (Cmd/Ctrl+P) and saves as PDF — no heavyweight server-side renderer
 * needed. The page also offers a "Share via WhatsApp" button that opens
 * `https://wa.me/...?text=...` pre-filled with a link to this page.
 *
 * Bilingual rendering: by default uses the prescription's stored `locale`
 * (frozen at issue time). If that locale is "ar" the body is RTL; the header
 * always shows the clinic name in the prescription locale.
 */
export default async function PrescriptionPrintPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const result = await getPrescription(id);
  if (!result.ok) notFound();
  const p = result.data;

  // Force the document locale to whatever was set at issue time so a patient
  // viewing in `/en/` still sees their French/Arabic prescription.
  const docLocale = (["fr", "en"].includes(p.locale) ? p.locale : "fr") as Locale;
  const t = await getTranslations({ locale: docLocale, namespace: "Prescriptions.doc" });
  const tList = await getTranslations({ locale: docLocale, namespace: "Prescriptions" });
  const dir = isRtl(docLocale) ? "rtl" : "ltr";

  const dateFmt = (d: Date) =>
    formatDate(d, docLocale, { day: "numeric", month: "long", year: "numeric" });

  // Title for the WhatsApp share message — the URL is appended at click time
  // by `<ShareWhatsAppButton>` (it calls /api/.../share, uploads PDF to
  // Cloudinary, then opens wa.me with the resulting public URL).
  const shareTitle = `${tList("doc.title")} — ${p.patientName}`;

  return (
    <div className="bg-muted/30 min-h-screen py-8 print:bg-white print:py-0">
      {/* ─── Toolbar (hidden when printing) ─── */}
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between px-4 print:hidden">
        <Link
          href={`/patients/${p.patientId}?tab=prescriptions` as never}
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
          {tList("title")}
        </Link>
        <div className="flex items-center gap-2">
          <ShareWhatsAppButton
            phone={p.patientPhone}
            title={shareTitle}
            shareEndpoint={`/api/prescriptions/${p.id}/share`}
            label={tList("share")}
          />
          <PrintButton label={tList("print")} />
        </div>
      </div>

      {/* ─── Document ─── */}
      <article
        dir={dir}
        lang={docLocale}
        className="mx-auto max-w-3xl bg-white p-10 shadow-sm print:max-w-none print:p-12 print:shadow-none"
        style={{ minHeight: "29.7cm" }}
      >
        {/* Header */}
        <header className="border-b-2 border-slate-300 pb-4">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-2xl font-bold tracking-tight text-slate-900">
                {p.clinicName}
              </div>
              {p.clinicAddress && (
                <div className="mt-0.5 text-sm text-slate-600">{p.clinicAddress}</div>
              )}
              {p.clinicPhone && (
                <div className="num mt-0.5 text-sm text-slate-600">
                  {formatMoroccanPhone(p.clinicPhone)}
                </div>
              )}
            </div>
            <div className="text-end">
              <div className="text-xs font-medium tracking-widest text-cyan-700 uppercase">
                {t("title")}
              </div>
              <div className="text-muted-foreground num mt-2 text-xs">
                {t("issuedAt")} {dateFmt(p.issuedAt)}
              </div>
            </div>
          </div>
        </header>

        {/* Patient block */}
        <section className="mt-6 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div>
            <div className="text-xs font-medium tracking-wider text-slate-500 uppercase">
              {t("patient")}
            </div>
            <div className="mt-1 text-base font-semibold text-slate-900">{p.patientName}</div>
          </div>
          <div>
            <div className="text-xs font-medium tracking-wider text-slate-500 uppercase">
              {t("dob")}
            </div>
            <div className="num mt-1 text-base text-slate-900">{dateFmt(p.patientDob)}</div>
          </div>
          {p.patientCin && (
            <div>
              <div className="text-xs font-medium tracking-wider text-slate-500 uppercase">
                {t("cin")}
              </div>
              <div className="num mt-1 text-slate-700">{p.patientCin}</div>
            </div>
          )}
          <div>
            <div className="text-xs font-medium tracking-wider text-slate-500 uppercase">
              {t("phone")}
            </div>
            <div className="num mt-1 text-slate-700">{formatMoroccanPhone(p.patientPhone)}</div>
          </div>
        </section>

        {/* Items */}
        <section className="mt-8">
          <ol className="space-y-4">
            {p.items.map((it, idx) => (
              <li key={it.id} className="flex gap-3">
                <span className="num text-cyan-700 mt-0.5 w-6 shrink-0 text-base font-bold">
                  {idx + 1}.
                </span>
                <div className="flex-1">
                  <div className="text-base font-semibold text-slate-900">{it.drug}</div>
                  <div className="mt-1 grid grid-cols-1 gap-x-4 text-sm text-slate-700 sm:grid-cols-3">
                    {it.dosage && (
                      <div>
                        <span className="text-slate-500">·</span> {it.dosage}
                      </div>
                    )}
                    {it.frequency && (
                      <div>
                        <span className="text-slate-500">·</span> {it.frequency}
                      </div>
                    )}
                    {it.duration && (
                      <div>
                        <span className="text-slate-500">·</span> {it.duration}
                      </div>
                    )}
                  </div>
                  {it.instructions && (
                    <div className="mt-1 text-sm italic text-slate-600">{it.instructions}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Notes */}
        {p.notes && (
          <section className="mt-8 rounded-md border-s-4 border-amber-300 bg-amber-50 p-4">
            <div className="text-xs font-medium tracking-wider text-amber-800 uppercase">
              {t("instructions")}
            </div>
            <p className="mt-1 text-sm whitespace-pre-wrap text-amber-900">{p.notes}</p>
          </section>
        )}

        {/* Signature block */}
        <footer className="mt-16 grid grid-cols-2 items-end gap-6">
          <div className="text-xs text-slate-400">{t("footer")}</div>
          <div className="text-end">
            <div className="text-sm font-semibold text-slate-900">
              {t("dentist")} {p.dentistName}
            </div>
            <div className="mt-12 border-t border-slate-300 pt-2 text-xs text-slate-500">
              {t("signature")}
            </div>
          </div>
        </footer>
      </article>
    </div>
  );
}

function PrintButton({ label }: { label: string }) {
  // Tiny client island so the button can call window.print().
  return <PrintButtonInner label={label} />;
}
