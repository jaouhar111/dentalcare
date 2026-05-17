/**
 * Types shared between the audit-log Server Actions and their Server / Client
 * consumers. Lives in a sibling file because Next.js forbids exporting
 * non-async values from a "use server" module.
 */

export interface AuditLogQuery {
  entity?: string;
  action?: string;
  userId?: string;
  /// ISO date (inclusive lower bound).
  from?: string;
  /// ISO date (exclusive upper bound — set to "2026-01-02" for "all of Jan 1").
  to?: string;
  /// 0-based offset into the result set.
  offset?: number;
  /// Items per page (clamped 1-200, default 50).
  pageSize?: number;
}

export interface AuditLogListItem {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
  payload: unknown;
  userName: string | null;
  userEmail: string | null;
}

export interface AuditLogPage {
  items: AuditLogListItem[];
  total: number;
  offset: number;
  pageSize: number;
}
