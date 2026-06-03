import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { CabinetInsights } from "@/server/actions/insights";

/**
 * Phase 12 — Stage E
 *
 * Monthly « Votre bot ce mois » PDF — sent by email to each cabinet on
 * the 1st of each month. Designed to fit on a single A4 page so the
 * dentist actually reads it. Apple-flat aesthetic translated to print :
 *
 *   - Hero number : "X RDV pris par votre AI Receptionist en mai"
 *   - 4 KPI tiles in a 2×2 grid
 *   - Top 3 questions
 *   - A short sales-pitch line at the bottom
 *
 * The HTML insights page is the interactive surface ; this PDF is the
 * « preuve de valeur que tu peux montrer à tes confrères » physical
 * artifact. Use bold sans-serif (Helvetica) because cabinets print on
 * cheap paper and we want it to survive.
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    color: "#1d1d1f",
    fontSize: 11,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  brand: {
    fontSize: 9,
    color: "#86868b",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1d1d1f",
    marginTop: 4,
    marginBottom: 4,
  },
  heroPeriod: {
    fontSize: 11,
    color: "#0066cc",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroSub: {
    fontSize: 12,
    color: "#6e6e73",
    marginTop: 8,
    lineHeight: 1.4,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#0000000d",
    marginVertical: 18,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpi: {
    width: "47%",
    backgroundColor: "#f5f5f7",
    borderRadius: 12,
    padding: 14,
  },
  kpiLabel: {
    fontSize: 9,
    color: "#6e6e73",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "bold",
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1d1d1f",
    marginTop: 6,
  },
  kpiSub: {
    fontSize: 9,
    color: "#6e6e73",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1d1d1f",
    marginBottom: 8,
  },
  qList: {
    flexDirection: "column",
    gap: 8,
  },
  qRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f5f5f7",
    borderRadius: 10,
    padding: 10,
  },
  qIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#0071e3",
    color: "#ffffff",
    fontSize: 10,
    textAlign: "center",
    paddingTop: 5,
    fontWeight: "bold",
    marginRight: 10,
  },
  qBody: {
    flex: 1,
  },
  qText: {
    fontSize: 10.5,
    color: "#1d1d1f",
    fontWeight: "bold",
  },
  qMeta: {
    fontSize: 8,
    color: "#86868b",
    marginTop: 2,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8.5,
    color: "#86868b",
    textAlign: "center",
    lineHeight: 1.4,
  },
});

interface MonthlyPdfProps {
  clinicName: string;
  insights: CabinetInsights;
}

function MonthlyInsightsDocument({ clinicName, insights }: MonthlyPdfProps) {
  const madFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.brand}>DentalCare — Votre bot ce mois</Text>
          <Text style={styles.heroPeriod}>{insights.period.label}</Text>
          <Text style={styles.heroTitle}>{clinicName}</Text>
          <Text style={styles.heroSub}>
            En un coup d&apos;oeil, voici ce que l&apos;AI Receptionist a
            apporté à votre cabinet ce mois-ci. Conservez ce document pour
            comparer mois après mois.
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.grid}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>RDV pris par l&apos;IA</Text>
            <Text style={styles.kpiValue}>
              {insights.totals.appointmentsCreatedByAI}
            </Text>
            <Text style={styles.kpiSub}>
              {insights.totals.aiBookingShareRate}% du total
            </Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Revenus générés</Text>
            <Text style={styles.kpiValue}>
              {madFmt.format(insights.totals.revenueFromAI)} MAD
            </Text>
            <Text style={styles.kpiSub}>
              paiements liés aux RDV de l&apos;IA
            </Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Temps économisé</Text>
            <Text style={styles.kpiValue}>
              {insights.totals.timeSavedHours} h
            </Text>
            <Text style={styles.kpiSub}>
              {insights.totals.aiTurnsCount} messages traités à votre place
            </Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Patients récupérés</Text>
            <Text style={styles.kpiValue}>
              {insights.totals.offHoursAppointments}
            </Text>
            <Text style={styles.kpiSub}>
              entre 22h et 8h — sans vous réveiller
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View>
          <Text style={styles.sectionTitle}>Top questions des patients</Text>
          {insights.topQuestions.length === 0 ? (
            <Text style={styles.heroSub}>
              Pas encore assez de conversations pour identifier des tendances ce mois-ci.
            </Text>
          ) : (
            <View style={styles.qList}>
              {insights.topQuestions.slice(0, 3).map((q, i) => (
                <View key={q.signature} style={styles.qRow}>
                  <Text style={styles.qIndex}>{i + 1}</Text>
                  <View style={styles.qBody}>
                    <Text style={styles.qText}>« {q.example} »</Text>
                    <Text style={styles.qMeta}>
                      {q.count} occurrence{q.count > 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <Text style={styles.footer}>
          DentalCare — AI Receptionist pour cabinets dentaires. Ce
          rapport est généré automatiquement chaque mois à partir des données
          réelles de votre cabinet. Pour toute question :
          support@dentalcare.ma
        </Text>
      </Page>
    </Document>
  );
}

/**
 * Renders the PDF to a Node Buffer — ready for Resend attachment OR
 * Cloudinary upload OR direct download.
 */
export async function renderMonthlyInsightsPdf(
  props: MonthlyPdfProps,
): Promise<Buffer> {
  const stream = await pdf(<MonthlyInsightsDocument {...props} />).toBuffer();
  return stream as unknown as Buffer;
}
