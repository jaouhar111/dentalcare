import { Prisma } from "@prisma/client";
import { db } from "./client";

/**
 * Set of Prisma model names whose rows are scoped by `clinicId`.
 * Adding a new multi-tenant model? List it here so the extension below
 * automatically injects `where: { clinicId }` on reads and `data: { clinicId }`
 * on writes for any code path using {@link forClinic}.
 */
const TENANT_MODELS = new Set<string>([
  // Phase 1: User
  "User",
  // Phase 2: Patient + audit (PatientAllergy reaches through patient, no own clinicId)
  "Patient",
  "AuditLog",
  // Phase 3: Dentist (schedules & absences reach through dentist)
  "Dentist",
  // Phase 4: Appointment + waitlist
  "Appointment",
  "WaitlistEntry",
  // Phase 5: Medical records (notes, radiographs, treatment photos)
  "MedicalNote",
  "Radiograph",
  "TreatmentPhoto",
  // Phase 6: Treatments (catalog + applications)
  "TreatmentCatalogItem",
  "TreatmentApplication",
  // Phase 7: Odontogram (per-tooth conditions, append-only history)
  "DentalChartEntry",
  // Phase 8: Prescriptions (items reach through the parent prescription)
  "Prescription",
  // Phase 9: Billing (lines reach through Invoice, installments through Plan)
  "Invoice",
  "Payment",
  "PaymentPlan",
  // Phase 10: Stock (movements reach through StockItem)
  "StockItem",
  "StockMovement",
  // Phase 11: Recall reminders
  "RecallReminder",
]);

/**
 * Returns a Prisma client bound to a specific clinic.
 *
 * On every query touching a tenant-scoped model:
 *  - findMany / findFirst / findUnique / count / aggregate / groupBy
 *    receive an implicit `where: { clinicId }`
 *  - create / createMany receive `data: { clinicId, …userData }`
 *  - update / updateMany / delete / deleteMany add `where: { clinicId }`
 *
 * Callers should NEVER pass `clinicId` themselves — the extension fills it in.
 * Cross-tenant reads (e.g. admin tools) must go through the unscoped `db`
 * directly and pass an explicit `clinicId` filter.
 */
export function forClinic(clinicId: string) {
  return db.$extends({
    name: `tenant-scope-${clinicId}`,
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) {
            return query(args);
          }

          const a = args as Record<string, unknown>;

          switch (operation) {
            case "findUnique":
            case "findFirst":
            case "findMany":
            case "count":
            case "aggregate":
            case "groupBy":
            case "update":
            case "updateMany":
            case "delete":
            case "deleteMany": {
              const existing = (a.where ?? {}) as Record<string, unknown>;
              a.where = { ...existing, clinicId };
              break;
            }
            case "create": {
              const existing = (a.data ?? {}) as Record<string, unknown>;
              a.data = { ...existing, clinicId };
              break;
            }
            case "createMany":
            case "createManyAndReturn": {
              const existing = (a.data ?? []) as Array<Record<string, unknown>>;
              a.data = (Array.isArray(existing) ? existing : [existing]).map((row) => ({
                ...row,
                clinicId,
              }));
              break;
            }
            case "upsert": {
              const where = (a.where ?? {}) as Record<string, unknown>;
              const create = (a.create ?? {}) as Record<string, unknown>;
              a.where = { ...where, clinicId };
              a.create = { ...create, clinicId };
              break;
            }
            // findUniqueOrThrow, findFirstOrThrow handled like their non-throw siblings
            case "findUniqueOrThrow":
            case "findFirstOrThrow": {
              const existing = (a.where ?? {}) as Record<string, unknown>;
              a.where = { ...existing, clinicId };
              break;
            }
            default:
              break;
          }
          return query(args);
        },
      },
    },
  });
}

export type ScopedDb = ReturnType<typeof forClinic>;

// Re-export for callers that prefer `Prisma.Foo` types from a single import.
export { Prisma };
