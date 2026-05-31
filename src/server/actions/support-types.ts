/**
 * Shared types for the support-tickets pipeline.
 *
 * Lives in its own file (not in the "use server" module) so React
 * Server Components and client components can both import the type
 * definitions — "use server" files are restricted to async function
 * exports.
 */
import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@prisma/client";

/** Row shape used by the cabinet's own /support list page. */
export interface SupportTicketListItem {
  id: string;
  subject: string;
  status: SupportTicketStatus;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  lastActivityAt: Date;
  createdAt: Date;
  createdByName: string;
  replyCount: number;
}

/** Row shape for super-admin's cross-tenant inbox. */
export interface SupportTicketInboxItem extends SupportTicketListItem {
  clinicId: string;
  clinicName: string;
  clinicLogoUrl: string | null;
}

/** Full ticket detail (thread + meta). */
export interface SupportTicketDetail {
  id: string;
  clinicId: string;
  clinicName: string;
  subject: string;
  body: string;
  status: SupportTicketStatus;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  createdAt: Date;
  resolvedAt: Date | null;
  lastActivityAt: Date;
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  };
  replies: Array<{
    id: string;
    body: string;
    isFromSuperAdmin: boolean;
    createdAt: Date;
    authorName: string;
  }>;
}

export interface CreateTicketInput {
  subject: string;
  body: string;
  category: SupportTicketCategory;
  priority?: SupportTicketPriority;
}

export interface ReplyToTicketInput {
  ticketId: string;
  body: string;
  /** Optional: set the new status atomically with the reply. */
  newStatus?: SupportTicketStatus;
}
