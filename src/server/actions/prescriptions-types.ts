/**
 * Types shared between the `"use server"` prescriptions module and UI.
 * Kept in a sibling file to obey Next.js's rule that "use server" can only
 * export async functions.
 */

export interface PrescriptionItemLite {
  id: string;
  drug: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  sortOrder: number;
}

export interface PrescriptionListItem {
  id: string;
  patientId: string;
  dentistId: string;
  dentistName: string;
  appointmentId: string | null;
  locale: string;
  notes: string | null;
  issuedAt: Date;
  itemCount: number;
}

export interface PrescriptionDetail extends PrescriptionListItem {
  items: PrescriptionItemLite[];
  patientName: string;
  patientDob: Date;
  patientCin: string | null;
  patientPhone: string;
  clinicName: string;
  clinicAddress: string | null;
  clinicPhone: string | null;
}
