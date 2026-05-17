import type { StockMovementType } from "@prisma/client";

/**
 * Types shared between the `"use server"` stock actions module and the UI.
 * Kept in a sibling file to obey Next.js's async-only export rule.
 */

export interface StockItemListItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  category: string | null;
  /// Live aggregate: sum of all movement.quantity rows for this item.
  quantity: number;
  lowStockAt: number | null;
  /// `quantity <= lowStockAt` (excludes the strict `== 0` case which has its
  /// own visual treatment).
  isLow: boolean;
  isOutOfStock: boolean;
  expiresAt: Date | null;
  /// `expiresAt <= now + 30 days` — used to highlight rows about to expire.
  isExpiringSoon: boolean;
  isExpired: boolean;
  isActive: boolean;
  updatedAt: Date;
}

export interface StockMovementLite {
  id: string;
  type: StockMovementType;
  quantity: number;
  unitPrice: number | null;
  note: string | null;
  recordedAt: Date;
  recordedByName: string;
}

export interface StockItemDetail extends StockItemListItem {
  description: string | null;
  movements: StockMovementLite[];
}
