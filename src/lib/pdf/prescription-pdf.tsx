import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { PrescriptionDetail } from "@/server/actions/prescriptions-types";

/**
 * Server-side prescription PDF. Built with @react-pdf/renderer so the output
 * is a real, downloadable PDF (not an HTML print preview) — that's what the
 * WhatsApp share link points to.
 *
 * Locale handling: we render in French only for V1. Mixing RTL Arabic into a
 * PDF requires registering an Arabic-script font with `Font.register`; the
 * /prescriptions/[id] HTML print page remains the bilingual surface for now.
 */
const styles = StyleSheet.create({
  page: {
    fontSize: 11,
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
  docTitle: { fontSize: 10, color: "#0e7490", letterSpacing: 3, fontWeight: 700 },
  patientBlock: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 22,
  },
  patientCol: { width: "50%", marginBottom: 8 },
  label: { fontSize: 8, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 },
  value: { fontSize: 12, color: "#0f172a", marginTop: 2 },
  itemsTitle: {
    marginTop: 24,
    fontSize: 11,
    color: "#0e7490",
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  itemRow: {
    flexDirection: "row",
    marginTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
  },
  itemIndex: {
    width: 22,
    fontSize: 13,
    fontWeight: 700,
    color: "#0e7490",
    marginTop: 1,
  },
  itemBody: { flex: 1 },
  itemDrug: { fontSize: 12, fontWeight: 700, color: "#0f172a" },
  itemMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 3,
  },
  itemMetaCell: { fontSize: 10, color: "#475569", marginRight: 14 },
  itemInstructions: { fontSize: 9, color: "#64748b", marginTop: 3, fontStyle: "italic" },
  notesBlock: {
    marginTop: 18,
    backgroundColor: "#fefce8",
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#facc15",
  },
  notesLabel: { fontSize: 8, color: "#713f12", textTransform: "uppercase", letterSpacing: 1 },
  notesText: { fontSize: 10, color: "#713f12", marginTop: 3 },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signature: {
    width: 220,
    borderTopWidth: 0.5,
    borderTopColor: "#94a3b8",
    paddingTop: 4,
    fontSize: 9,
    color: "#64748b",
    textAlign: "center",
  },
  signatureName: { fontSize: 11, fontWeight: 700, color: "#0f172a", marginBottom: 50 },
});

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-MA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

function PrescriptionPDF({ p }: { p: PrescriptionDetail }) {
  return (
    <Document
      title={`Ordonnance ${p.patientName}`}
      author={p.clinicName}
      subject={`Ordonnance pour ${p.patientName}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            {p.clinicLogoUrl && (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image
                src={p.clinicLogoUrl}
                style={{ width: 48, height: 48, objectFit: "contain" }}
              />
            )}
            <View>
              <Text style={styles.clinicName}>{p.clinicName}</Text>
              {p.clinicAddress && <Text style={styles.clinicMeta}>{p.clinicAddress}</Text>}
              {p.clinicPhone && <Text style={styles.clinicMeta}>{p.clinicPhone}</Text>}
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.docTitle}>ORDONNANCE</Text>
            <Text style={[styles.clinicMeta, { marginTop: 8 }]}>
              Émise le {fmtDate(p.issuedAt)}
            </Text>
          </View>
        </View>

        <View style={styles.patientBlock}>
          <View style={styles.patientCol}>
            <Text style={styles.label}>Patient</Text>
            <Text style={styles.value}>{p.patientName}</Text>
          </View>
          <View style={styles.patientCol}>
            <Text style={styles.label}>Né(e) le</Text>
            <Text style={styles.value}>{fmtDate(p.patientDob)}</Text>
          </View>
          {p.patientCin && (
            <View style={styles.patientCol}>
              <Text style={styles.label}>CIN</Text>
              <Text style={styles.value}>{p.patientCin}</Text>
            </View>
          )}
          <View style={styles.patientCol}>
            <Text style={styles.label}>Téléphone</Text>
            <Text style={styles.value}>{p.patientPhone}</Text>
          </View>
        </View>

        <Text style={styles.itemsTitle}>Prescription</Text>
        {p.items.map((item, idx) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.itemIndex}>{idx + 1}.</Text>
            <View style={styles.itemBody}>
              <Text style={styles.itemDrug}>{item.drug}</Text>
              <View style={styles.itemMetaRow}>
                {item.dosage && <Text style={styles.itemMetaCell}>· {item.dosage}</Text>}
                {item.frequency && <Text style={styles.itemMetaCell}>· {item.frequency}</Text>}
                {item.duration && <Text style={styles.itemMetaCell}>· {item.duration}</Text>}
              </View>
              {item.instructions && (
                <Text style={styles.itemInstructions}>{item.instructions}</Text>
              )}
            </View>
          </View>
        ))}

        {p.notes && (
          <View style={styles.notesBlock}>
            <Text style={styles.notesLabel}>Instructions complémentaires</Text>
            <Text style={styles.notesText}>{p.notes}</Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={{ fontSize: 8, color: "#94a3b8" }}>
            Document généré par DentalCare
          </Text>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.signatureName}>Dr {p.dentistName}</Text>
            <Text style={styles.signature}>Signature et cachet</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderPrescriptionPdf(p: PrescriptionDetail): Promise<Buffer> {
  const blob = await pdf(<PrescriptionPDF p={p} />).toBlob();
  const ab = await blob.arrayBuffer();
  return Buffer.from(ab);
}
