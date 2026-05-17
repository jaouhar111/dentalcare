import type { RadiographKind, TreatmentPhotoStage } from "@prisma/client";

/**
 * Plain types shared across the medical Server Actions and the UI layer.
 *
 * Lives outside `medical.ts` because that file is `"use server"` — Next.js
 * forbids type/interface re-exports from "use server" modules (they would be
 * picked up by the action-bundler as runtime exports and fail at runtime).
 */

export interface MedicalNoteListItem {
  id: string;
  title: string | null;
  body: string;
  appointmentId: string | null;
  authorName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RadiographListItem {
  id: string;
  kind: RadiographKind;
  takenAt: Date;
  note: string | null;
  dentistName: string | null;
  uploaderName: string;
  url: string;
  thumbnailUrl: string;
  createdAt: Date;
}

export interface TreatmentPhotoListItem {
  id: string;
  stage: TreatmentPhotoStage;
  caption: string | null;
  dentistName: string | null;
  appointmentId: string | null;
  uploaderName: string;
  url: string;
  thumbnailUrl: string;
  createdAt: Date;
}

export type TimelineEntry =
  | { kind: "NOTE"; date: Date; data: MedicalNoteListItem }
  | { kind: "RADIOGRAPH"; date: Date; data: RadiographListItem }
  | { kind: "PHOTO"; date: Date; data: TreatmentPhotoListItem };
