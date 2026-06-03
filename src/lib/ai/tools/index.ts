/**
 * Booking toolkit — builds the 6 tools exposed to the AI for the
 * WhatsApp booking flow. Always call `buildBookingTools(ctx)` once per
 * conversation; the same instances are reused across the model loop's
 * iterations, which lets a single context object (clinicId, patientId)
 * stay bound to every tool's handler.
 *
 * Tool ordering matters for prompt clarity: cabinet info first (cheap,
 * read-only), then patient-context lookups, then writes (create patient,
 * create appointment, cancel). The model reads the list top-down when
 * choosing which to call.
 *
 * Reschedule is intentionally NOT a dedicated tool — the model can chain
 * cancel + create which is more transparent in the audit log + gives the
 * patient a chance to opt out between the two steps. We can add a real
 * `reschedule_appointment` later if the cancel/create dance turns out to
 * be too verbose.
 */

import type { AITool } from "../types";
import type { AIToolContext } from "./context";
import { getCabinetInfoTool } from "./get-cabinet-info";
import { searchAvailableSlotsTool } from "./search-available-slots";
import { findEmergencySlotTool } from "./find-emergency-slot";
import { listMyAppointmentsTool } from "./list-my-appointments";
import { createPatientTool } from "./create-patient";
import { createAppointmentTool } from "./create-appointment";
import { cancelAppointmentTool } from "./cancel-appointment";
import { proposeRescheduleSlotsTool } from "./propose-reschedule-slots";

export function buildBookingTools(ctx: AIToolContext): AITool[] {
  return [
    getCabinetInfoTool(ctx),
    searchAvailableSlotsTool(ctx),
    findEmergencySlotTool(ctx),
    listMyAppointmentsTool(ctx),
    proposeRescheduleSlotsTool(ctx),
    createPatientTool(ctx),
    createAppointmentTool(ctx),
    cancelAppointmentTool(ctx),
  ];
}

export type { AIToolContext };
