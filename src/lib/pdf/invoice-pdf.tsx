import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { InvoiceDetail } from "@/server/actions/invoices-types";

/**
 * Server-side invoice PDF. Built with @react-pdf/renderer so the output is a
 * real, downloadable PDF (not the HTML print preview) — that's what the
 * WhatsApp share link points to.
 *
 * Kept locale-light: we only embed FR vocabulary for now since cabinets in
 * Fès deal in French invoices. Localising to AR with proper RTL would require
 * an Arabic-script PDF font registered with `Font.register`, out of scope for
 * V1. The HTML print page remains the proper bilingual surface.
 */
const styles = StyleSheet.create({
  page: {
    fontSize: 10,
    fontFamily: "Helvetica",
    padding: 40,
    color: "#1e293b",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 12,
  },
  clinicName: { fontSize: 16, fontWeight: 700, color: "#0f172a" },
  clinicMeta: { fontSize: 9, color: "#475569", marginTop: 2 },
  docTitle: { fontSize: 9, color: "#0e7490", letterSpacing: 2, fontWeight: 700 },
  number: { fontSize: 16, fontWeight: 700, marginTop: 2, color: "#0f172a" },
  patientBlock: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 18,
  },
  patientCol: { width: "50%", marginBottom: 8 },
  label: { fontSize: 8, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 },
  value: { fontSize: 11, color: "#0f172a", marginTop: 2 },
  table: { marginTop: 18 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: "#94a3b8",
    paddingBottom: 5,
    paddingTop: 4,
  },
  tableHeaderCell: { fontSize: 8, color: "#64748b", fontWeight: 700, letterSpacing: 1 },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
  },
  cellDesc: { flexGrow: 1, paddingRight: 6 },
  cellQty: { width: 40, textAlign: "right" },
  cellPrice: { width: 80, textAlign: "right" },
  cellTotal: { width: 90, textAlign: "right" },
  rowText: { fontSize: 10 },
  rowMeta: { fontSize: 8, color: "#64748b", marginTop: 1 },
  totals: {
    marginTop: 14,
    borderTopWidth: 1.5,
    borderTopColor: "#94a3b8",
    paddingTop: 6,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 2,
  },
  totalLabel: { fontSize: 10, color: "#475569", marginRight: 16 },
  totalValue: { fontSize: 10, color: "#0f172a", width: 90, textAlign: "right" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#475569",
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
    marginRight: 16,
  },
  grandTotalValue: {
    fontSize: 16,
    fontWeight: 700,
    color: "#0e7490",
    width: 130,
    textAlign: "right",
  },
  vatNote: { fontSize: 8, color: "#94a3b8", marginTop: 4, textAlign: "right" },
  paidBlock: {
    marginTop: 14,
    backgroundColor: "#ecfdf5",
    padding: 10,
    borderRadius: 4,
  },
  paidRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 1,
  },
  notesBlock: {
    marginTop: 14,
    backgroundColor: "#fefce8",
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#facc15",
  },
  notesText: { fontSize: 9, color: "#713f12" },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signature: {
    width: 200,
    borderTopWidth: 0.5,
    borderTopColor: "#94a3b8",
    paddingTop: 4,
    fontSize: 8,
    color: "#64748b",
    textAlign: "center",
  },
});

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-MA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

function InvoicePDF({ inv }: { inv: InvoiceDetail }) {
  return (
    <Document
      title={`Facture ${inv.number ?? ""}`}
      author={inv.clinicName}
      subject={`Facture pour ${inv.patientName}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.clinicName}>{inv.clinicName}</Text>
            {inv.clinicAddress && <Text style={styles.clinicMeta}>{inv.clinicAddress}</Text>}
            {inv.clinicPhone && <Text style={styles.clinicMeta}>{inv.clinicPhone}</Text>}
            {inv.clinicVatNumber && (
              <Text style={styles.clinicMeta}>N° TVA {inv.clinicVatNumber}</Text>
            )}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.docTitle}>FACTURE</Text>
            <Text style={styles.number}>{inv.number ?? "—"}</Text>
            {inv.emittedAt && (
              <Text style={[styles.clinicMeta, { marginTop: 6 }]}>
                Émise le {fmtDate(inv.emittedAt)}
              </Text>
            )}
            {inv.dueDate && (
              <Text style={styles.clinicMeta}>Échéance {fmtDate(inv.dueDate)}</Text>
            )}
          </View>
        </View>

        <View style={styles.patientBlock}>
          <View style={styles.patientCol}>
            <Text style={styles.label}>Patient</Text>
            <Text style={styles.value}>{inv.patientName}</Text>
          </View>
          <View style={styles.patientCol}>
            <Text style={styles.label}>Né(e) le</Text>
            <Text style={styles.value}>{fmtDate(inv.patientDob)}</Text>
          </View>
          {inv.patientCin && (
            <View style={styles.patientCol}>
              <Text style={styles.label}>CIN</Text>
              <Text style={styles.value}>{inv.patientCin}</Text>
            </View>
          )}
          <View style={styles.patientCol}>
            <Text style={styles.label}>Téléphone</Text>
            <Text style={styles.value}>{inv.patientPhone}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.cellDesc]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.cellQty]}>Qté</Text>
            <Text style={[styles.tableHeaderCell, styles.cellPrice]}>PU</Text>
            <Text style={[styles.tableHeaderCell, styles.cellTotal]}>Total</Text>
          </View>
          {inv.lines.map((l) => (
            <View key={l.id} style={styles.tableRow}>
              <View style={styles.cellDesc}>
                <Text style={styles.rowText}>{l.description}</Text>
                {l.toothNumber !== null && (
                  <Text style={styles.rowMeta}>FDI {l.toothNumber}</Text>
                )}
              </View>
              <Text style={[styles.rowText, styles.cellQty]}>{l.quantity}</Text>
              <Text style={[styles.rowText, styles.cellPrice]}>{fmt(l.unitPrice)}</Text>
              <Text style={[styles.rowText, styles.cellTotal, { fontWeight: 700 }]}>
                {fmt(l.lineTotal)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalLabel}>Sous-total</Text>
            <Text style={styles.totalValue}>{fmt(inv.subtotal)}</Text>
          </View>
          {inv.discountAmount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalLabel}>Remise</Text>
              <Text style={[styles.totalValue, { color: "#be123c" }]}>
                − {fmt(inv.discountAmount)}
              </Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL TTC</Text>
            <Text style={styles.grandTotalValue}>{fmt(inv.total)}</Text>
          </View>
          <Text style={styles.vatNote}>
            TVA 0 % — Actes médicaux exonérés (art. 91 CGI)
          </Text>
        </View>

        {inv.paid > 0 && (
          <View style={styles.paidBlock}>
            <View style={styles.paidRow}>
              <Text style={{ fontSize: 10, color: "#065f46", fontWeight: 700 }}>
                Total payé
              </Text>
              <Text style={{ fontSize: 10, color: "#047857", fontWeight: 700 }}>
                {fmt(inv.paid)}
              </Text>
            </View>
            {inv.remaining > 0 && (
              <View style={styles.paidRow}>
                <Text style={{ fontSize: 10, color: "#9f1239", fontWeight: 700 }}>
                  Restant dû
                </Text>
                <Text style={{ fontSize: 10, color: "#be123c", fontWeight: 700 }}>
                  {fmt(inv.remaining)}
                </Text>
              </View>
            )}
          </View>
        )}

        {inv.notes && (
          <View style={styles.notesBlock}>
            <Text style={styles.notesText}>{inv.notes}</Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={{ fontSize: 7, color: "#94a3b8" }}>
            Document généré par DentalCare
          </Text>
          <Text style={styles.signature}>Signature et cachet</Text>
        </View>
      </Page>
    </Document>
  );
}

/**
 * Renders the invoice to a PDF Buffer. The route handler streams this back
 * with `Content-Type: application/pdf`.
 */
export async function renderInvoicePdf(inv: InvoiceDetail): Promise<Buffer> {
  const blob = await pdf(<InvoicePDF inv={inv} />).toBlob();
  const ab = await blob.arrayBuffer();
  return Buffer.from(ab);
}
