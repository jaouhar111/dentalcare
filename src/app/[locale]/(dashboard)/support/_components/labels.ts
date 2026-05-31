import {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@prisma/client";

/**
 * Display metadata for support enums. Centralised so the cabinet inbox,
 * the super-admin inbox, and the detail page all use identical labels +
 * colors — no drift, no per-page typos.
 */

export const STATUS_STYLE: Record<
  SupportTicketStatus,
  { label: string; cls: string; dot: string }
> = {
  OPEN: {
    label: "Ouvert",
    cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    dot: "#3b82f6",
  },
  IN_PROGRESS: {
    label: "En cours",
    cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    dot: "#f59e0b",
  },
  WAITING_USER: {
    label: "En attente de vous",
    cls: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    dot: "#8b5cf6",
  },
  RESOLVED: {
    label: "Résolu",
    cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    dot: "#10b981",
  },
};

export const PRIORITY_STYLE: Record<
  SupportTicketPriority,
  { label: string; dot: string; rank: number }
> = {
  LOW: { label: "Basse", dot: "#94a3b8", rank: 1 },
  NORMAL: { label: "Normale", dot: "#3b82f6", rank: 2 },
  HIGH: { label: "Haute", dot: "#f59e0b", rank: 3 },
  URGENT: { label: "Urgente", dot: "#ef4444", rank: 4 },
};

export const CATEGORY_LABEL: Record<SupportTicketCategory, string> = {
  TECHNICAL_BUG: "Bug technique",
  HOW_TO: "Question d'usage",
  BILLING: "Abonnement",
  WHATSAPP: "WhatsApp",
  FEATURE_REQUEST: "Demande de fonctionnalité",
  ACCOUNT: "Compte",
  OTHER: "Autre",
};
