/**
 * Types for the platform alerts feed. Kept in a sibling file because the
 * `"use server"` alerts module can only export async functions.
 */
export type AlertSeverity = "critical" | "warning";

export interface PlatformAlert {
  id: string;
  severity: AlertSeverity;
  category: "billing" | "health";
  title: string;
  detail: string;
  href: string;
}
