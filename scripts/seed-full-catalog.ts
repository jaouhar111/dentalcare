/**
 * Upserts a comprehensive dental treatment catalog into every clinic.
 *
 * Idempotent: rows are matched on `(clinicId, code)` thanks to the unique
 * index in `prisma/schema.prisma`. Existing rows keep their current price
 * and color (the dentist may have customised them) — only `name`,
 * `description`, `defaultDurationMin`, `requiresTooth`, and `sortOrder`
 * are refreshed.
 *
 * Run with:
 *   pnpm tsx scripts/seed-full-catalog.ts
 */

import "dotenv/config";
import { db } from "@/lib/db/client";

interface CatalogItem {
  code: string;
  name: string;
  description?: string;
  color: string;
  /// MAD, median Casablanca/Fès practice 2026.
  price: number;
  dur: number;
  /// Whether the act applies to a specific tooth (drives the FDI picker UI).
  tooth: boolean;
  /// Display group + sort hint (1xx examens, 2xx hygiène, …).
  sortOrder: number;
}

const CATALOG: CatalogItem[] = [
  // ─── Examens & Diagnostic ──────────────────────────────────────────────
  { code: "EXAM",   name: "Examen / consultation",        color: "#64748B", price: 150, dur: 30, tooth: false, sortOrder: 100 },
  { code: "DIAG",   name: "Diagnostic + plan de traitement", description: "Examen approfondi avec plan", color: "#475569", price: 250, dur: 45, tooth: false, sortOrder: 105 },
  { code: "URG",    name: "Consultation d'urgence",       color: "#F43F5E", price: 200, dur: 20, tooth: false, sortOrder: 110 },
  { code: "RX",     name: "Radiographie rétro-alvéolaire", color: "#94A3B8", price: 80,  dur: 10, tooth: true,  sortOrder: 120 },
  { code: "PANO",   name: "Radiographie panoramique",      color: "#94A3B8", price: 250, dur: 15, tooth: false, sortOrder: 125 },

  // ─── Hygiène / Prophylaxie ─────────────────────────────────────────────
  { code: "DET",    name: "Détartrage",                   color: "#06B6D4", price: 300, dur: 30, tooth: false, sortOrder: 200 },
  { code: "PROPH",  name: "Prophylaxie / polissage",      color: "#0EA5E9", price: 200, dur: 30, tooth: false, sortOrder: 210 },
  { code: "SEAL",   name: "Scellement de sillons",        description: "Prévention carie (souvent pédiatrique)", color: "#22D3EE", price: 150, dur: 20, tooth: true,  sortOrder: 220 },
  { code: "FLU",    name: "Fluoration",                   color: "#67E8F9", price: 200, dur: 15, tooth: false, sortOrder: 230 },

  // ─── Restaurations conservatrices ──────────────────────────────────────
  { code: "COMP1",  name: "Composite 1 face",             color: "#3B82F6", price: 350, dur: 30, tooth: true,  sortOrder: 300 },
  { code: "COMP2",  name: "Composite 2 faces",            color: "#2563EB", price: 450, dur: 40, tooth: true,  sortOrder: 305 },
  { code: "COMP3",  name: "Composite 3+ faces",           color: "#6366F1", price: 550, dur: 45, tooth: true,  sortOrder: 310 },
  { code: "INLAY",  name: "Inlay / Onlay céramique",       color: "#4F46E5", price: 1800, dur: 60, tooth: true, sortOrder: 320 },
  { code: "REC",    name: "Reconstitution corono-radiculaire", description: "RCR / Inlay-core métal", color: "#7C3AED", price: 900, dur: 45, tooth: true, sortOrder: 330 },

  // ─── Endodontie ────────────────────────────────────────────────────────
  { code: "PUL",    name: "Pulpectomie / coiffage",       color: "#A78BFA", price: 400, dur: 30, tooth: true,  sortOrder: 400 },
  { code: "ENDO1",  name: "Endodontie monoradiculée",     color: "#8B5CF6", price: 1000, dur: 60, tooth: true,  sortOrder: 410 },
  { code: "ENDO2",  name: "Endodontie biradiculée",       color: "#9333EA", price: 1300, dur: 75, tooth: true,  sortOrder: 415 },
  { code: "ENDO3",  name: "Endodontie pluriradiculée",    color: "#A855F7", price: 1700, dur: 90, tooth: true,  sortOrder: 420 },
  { code: "RETRAIT", name: "Reprise de traitement endo",  color: "#6D28D9", price: 1500, dur: 90, tooth: true,  sortOrder: 430 },

  // ─── Chirurgie ─────────────────────────────────────────────────────────
  { code: "EXT",    name: "Extraction simple",            color: "#F59E0B", price: 200, dur: 30, tooth: true,  sortOrder: 500 },
  { code: "EXTC",   name: "Extraction chirurgicale",      color: "#EF4444", price: 500, dur: 60, tooth: true,  sortOrder: 510 },
  { code: "DDS",    name: "Extraction dent de sagesse",   color: "#DC2626", price: 800, dur: 60, tooth: true,  sortOrder: 520 },
  { code: "GERME",  name: "Germectomie",                  description: "Extraction d'un germe non éruptée", color: "#B91C1C", price: 1000, dur: 60, tooth: true, sortOrder: 525 },
  { code: "APIC",   name: "Apicectomie",                  color: "#FB923C", price: 1500, dur: 75, tooth: true, sortOrder: 530 },
  { code: "FREIN",  name: "Frénectomie",                  color: "#FDBA74", price: 700, dur: 30, tooth: false, sortOrder: 540 },

  // ─── Parodontie ────────────────────────────────────────────────────────
  { code: "SURF",   name: "Surfaçage radiculaire",        color: "#EC4899", price: 600, dur: 45, tooth: false, sortOrder: 600 },
  { code: "LAMBE",  name: "Lambeau d'assainissement",     color: "#DB2777", price: 1800, dur: 90, tooth: false, sortOrder: 610 },
  { code: "MAINT",  name: "Maintenance parodontale",      color: "#F472B6", price: 400, dur: 30, tooth: false, sortOrder: 620 },

  // ─── Prothèse fixe ─────────────────────────────────────────────────────
  { code: "COUR",   name: "Couronne céramique",           color: "#10B981", price: 2500, dur: 60, tooth: true,  sortOrder: 700 },
  { code: "COUM",   name: "Couronne métal",               color: "#16A34A", price: 1500, dur: 60, tooth: true,  sortOrder: 705 },
  { code: "COUCM",  name: "Couronne céramo-métallique",   color: "#22C55E", price: 2000, dur: 60, tooth: true,  sortOrder: 710 },
  { code: "FACETTE", name: "Facette céramique",           color: "#34D399", price: 3500, dur: 60, tooth: true,  sortOrder: 720 },
  { code: "BRIDGE", name: "Bridge (par élément)",         color: "#059669", price: 2200, dur: 75, tooth: true,  sortOrder: 730 },

  // ─── Prothèse amovible ─────────────────────────────────────────────────
  { code: "PRTOT",  name: "Prothèse totale",              color: "#14B8A6", price: 4000, dur: 60, tooth: false, sortOrder: 800 },
  { code: "PRSTEL", name: "Prothèse partielle stellite",  color: "#2DD4BF", price: 4500, dur: 75, tooth: false, sortOrder: 810 },
  { code: "PRRES",  name: "Prothèse partielle résine",    color: "#5EEAD4", price: 2500, dur: 60, tooth: false, sortOrder: 820 },
  { code: "REBASE", name: "Rebasage de prothèse",         color: "#0D9488", price: 700, dur: 45, tooth: false, sortOrder: 830 },

  // ─── Implantologie ─────────────────────────────────────────────────────
  { code: "IMP",    name: "Implant unitaire",             color: "#A855F7", price: 7500, dur: 90, tooth: true,  sortOrder: 900 },
  { code: "IMPCOR", name: "Couronne sur implant",         color: "#9333EA", price: 3500, dur: 60, tooth: true,  sortOrder: 910 },
  { code: "GREFO",  name: "Greffe osseuse",               color: "#7E22CE", price: 3000, dur: 90, tooth: false, sortOrder: 920 },
  { code: "SINUS",  name: "Sinus lift",                   color: "#6B21A8", price: 5000, dur: 120, tooth: false, sortOrder: 930 },

  // ─── Orthodontie ───────────────────────────────────────────────────────
  { code: "ORTHODIAG", name: "Bilan orthodontique",       color: "#6366F1", price: 500, dur: 60, tooth: false, sortOrder: 1000 },
  { code: "ORTHOM",    name: "Séance orthodontie (mensuel)", color: "#4F46E5", price: 700, dur: 30, tooth: false, sortOrder: 1010 },
  { code: "ORTHOPOSE", name: "Pose appareil orthodontique", color: "#4338CA", price: 4500, dur: 90, tooth: false, sortOrder: 1020 },
  { code: "CONT",      name: "Contention post-orthodontie", color: "#818CF8", price: 800, dur: 30, tooth: false, sortOrder: 1030 },

  // ─── Esthétique ────────────────────────────────────────────────────────
  { code: "BLANC",   name: "Blanchiment dentaire",         color: "#F0F9FF", price: 1500, dur: 60, tooth: false, sortOrder: 1100 },
  { code: "BLANCA",  name: "Blanchiment au fauteuil",      color: "#BAE6FD", price: 2500, dur: 90, tooth: false, sortOrder: 1110 },

  // ─── Pédiatrie ─────────────────────────────────────────────────────────
  { code: "PED",     name: "Consultation pédodontique",    color: "#EAB308", price: 200, dur: 30, tooth: false, sortOrder: 1200 },
  { code: "PEDSCEL", name: "Scellement enfant",            color: "#FACC15", price: 150, dur: 20, tooth: true,  sortOrder: 1210 },

  // ─── Divers ────────────────────────────────────────────────────────────
  { code: "DRAIN",   name: "Drainage abcès",               color: "#F87171", price: 250, dur: 30, tooth: true,  sortOrder: 1300 },
  { code: "SUTURE",  name: "Suture / pansement",           color: "#FCA5A5", price: 150, dur: 15, tooth: false, sortOrder: 1310 },
];

async function main() {
  const clinics = await db.clinic.findMany({ select: { id: true, name: true } });
  if (clinics.length === 0) {
    console.log("❌ Aucune clinique en DB. Lance d'abord `pnpm db:seed`.");
    return;
  }

  console.log(`\n🏥 ${clinics.length} clinique(s) — upsert de ${CATALOG.length} actes dans chacune.\n`);

  let created = 0;
  let updated = 0;
  for (const clinic of clinics) {
    console.log(`▸ ${clinic.name}`);
    for (const item of CATALOG) {
      const existing = await db.treatmentCatalogItem.findUnique({
        where: { clinicId_code: { clinicId: clinic.id, code: item.code } },
        select: { id: true },
      });

      await db.treatmentCatalogItem.upsert({
        where: { clinicId_code: { clinicId: clinic.id, code: item.code } },
        // Refresh metadata but DO NOT overwrite a dentist-customised price/color.
        update: {
          name: item.name,
          description: item.description,
          defaultDurationMin: item.dur,
          requiresTooth: item.tooth,
          sortOrder: item.sortOrder,
        },
        create: {
          clinicId: clinic.id,
          code: item.code,
          name: item.name,
          description: item.description,
          defaultPrice: item.price,
          defaultDurationMin: item.dur,
          requiresTooth: item.tooth,
          color: item.color,
          sortOrder: item.sortOrder,
        },
      });

      if (existing) updated++;
      else created++;
    }
  }

  console.log(`\n✅ Catalogue à jour : ${created} créés, ${updated} mis à jour.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
