"use server";

import { revalidatePath } from "next/cache";
import { Prisma, StockMovementType, UserRole } from "@prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/rbac";
import { fail, ok, type Result } from "@/lib/utils/result";
import {
  createStockItemSchema,
  recordMovementSchema,
  updateStockItemSchema,
  type CreateStockItemInput,
  type RecordMovementInput,
  type UpdateStockItemInput,
} from "@/server/schemas/stock";
import type {
  StockItemDetail,
  StockItemListItem,
  StockMovementLite,
} from "./stock-types";

const ANY_STAFF = [UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST] as const;
const ADMIN_ONLY = [UserRole.ADMIN] as const;

const EXPIRING_SOON_DAYS = 30;

/**
 * Movement types that store the quantity as **negative** in the ledger:
 * consumption (used during a treatment) and return-to-supplier. Adjustments
 * and opening/purchase rows keep the sign provided by the action layer's
 * `recordMovement` call below.
 */
const OUTGOING_TYPES = new Set<StockMovementType>([
  StockMovementType.CONSUMPTION,
  StockMovementType.RETURN,
]);

function zodFieldsFromError(error: unknown): Record<string, string[]> {
  if (!(error instanceof Object) || !("issues" in error)) return {};
  const issues = (error as { issues: Array<{ path: (string | number)[]; message: string }> }).issues;
  const out: Record<string, string[]> = {};
  for (const i of issues) {
    const key = i.path.join(".") || "_form";
    (out[key] ??= []).push(i.message);
  }
  return out;
}

function computeFlags(
  qty: number,
  lowStockAt: number | null,
  expiresAt: Date | null,
): Pick<StockItemListItem, "isLow" | "isOutOfStock" | "isExpiringSoon" | "isExpired"> {
  const isOutOfStock = qty <= 0;
  const isLow = !isOutOfStock && lowStockAt !== null && qty <= lowStockAt;
  let isExpired = false;
  let isExpiringSoon = false;
  if (expiresAt) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    isExpired = expiresAt < today;
    if (!isExpired) {
      const horizon = new Date(today);
      horizon.setDate(horizon.getDate() + EXPIRING_SOON_DAYS);
      isExpiringSoon = expiresAt <= horizon;
    }
  }
  return { isLow, isOutOfStock, isExpiringSoon, isExpired };
}

// ─── Read ───────────────────────────────────────────────────────────────────

export async function listStockItems(args?: {
  includeInactive?: boolean;
  category?: string;
  /// "low" → items at or below lowStockAt (excluding out-of-stock).
  /// "out" → quantity ≤ 0.
  /// "expiring" → expiresAt within 30 days (and not expired).
  filter?: "all" | "low" | "out" | "expiring";
}): Promise<Result<StockItemListItem[]>> {
  const user = await requireRole([...ANY_STAFF]);
  const items = await db.stockItem.findMany({
    where: {
      clinicId: user.clinicId,
      ...(args?.includeInactive ? {} : { isActive: true }),
      ...(args?.category ? { category: args.category } : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { movements: true } },
    },
  });

  if (items.length === 0) return ok([]);

  // One grouped query for quantities instead of N per-item aggregates.
  const ids = items.map((i) => i.id);
  const sums = await db.stockMovement.groupBy({
    by: ["itemId"],
    where: { itemId: { in: ids } },
    _sum: { quantity: true },
  });
  const byId = new Map(sums.map((s) => [s.itemId, s._sum.quantity ?? 0]));

  let list: StockItemListItem[] = items.map((i) => {
    const qty = byId.get(i.id) ?? 0;
    const flags = computeFlags(qty, i.lowStockAt, i.expiresAt);
    return {
      id: i.id,
      code: i.code,
      name: i.name,
      unit: i.unit,
      category: i.category,
      quantity: qty,
      lowStockAt: i.lowStockAt,
      ...flags,
      expiresAt: i.expiresAt,
      isActive: i.isActive,
      updatedAt: i.updatedAt,
    };
  });

  switch (args?.filter) {
    case "low":
      list = list.filter((i) => i.isLow);
      break;
    case "out":
      list = list.filter((i) => i.isOutOfStock);
      break;
    case "expiring":
      list = list.filter((i) => i.isExpiringSoon || i.isExpired);
      break;
    default:
      break;
  }

  return ok(list);
}

export async function getStockItem(id: string): Promise<Result<StockItemDetail>> {
  const user = await requireRole([...ANY_STAFF]);
  const item = await db.stockItem.findFirst({
    where: { id, clinicId: user.clinicId },
    include: {
      movements: {
        orderBy: { recordedAt: "desc" },
        take: 50,
        include: { createdBy: { select: { fullName: true } } },
      },
    },
  });
  if (!item) return fail("NOT_FOUND", "Item not found");

  const qty = item.movements.reduce((s, m) => s + m.quantity, 0);
  const flags = computeFlags(qty, item.lowStockAt, item.expiresAt);
  const movements: StockMovementLite[] = item.movements.map((m) => ({
    id: m.id,
    type: m.type,
    quantity: m.quantity,
    unitPrice: m.unitPrice !== null ? Number(m.unitPrice) : null,
    note: m.note,
    recordedAt: m.recordedAt,
    recordedByName: m.createdBy.fullName,
  }));

  return ok({
    id: item.id,
    code: item.code,
    name: item.name,
    unit: item.unit,
    category: item.category,
    quantity: qty,
    lowStockAt: item.lowStockAt,
    ...flags,
    expiresAt: item.expiresAt,
    isActive: item.isActive,
    updatedAt: item.updatedAt,
    description: item.description,
    movements,
  });
}

// ─── Create / update ────────────────────────────────────────────────────────

export async function createStockItem(
  raw: CreateStockItemInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...ADMIN_ONLY]);
  const parsed = createStockItemSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid item", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const dup = await db.stockItem.findUnique({
    where: { clinicId_code: { clinicId: user.clinicId, code: data.code } },
    select: { id: true },
  });
  if (dup) return fail("DUPLICATE_CODE", "Code already exists", { code: ["DUPLICATE"] });

  const id = await db.$transaction(async (tx) => {
    const created = await tx.stockItem.create({
      data: {
        clinicId: user.clinicId,
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        unit: data.unit,
        lowStockAt: data.lowStockAt ?? null,
        expiresAt: data.expiresAt ? new Date(`${data.expiresAt}T12:00:00`) : null,
        category: data.category ?? null,
        isActive: data.isActive,
      },
      select: { id: true },
    });
    if (data.openingQuantity && data.openingQuantity > 0) {
      await tx.stockMovement.create({
        data: {
          clinicId: user.clinicId,
          itemId: created.id,
          type: StockMovementType.OPENING,
          quantity: data.openingQuantity,
          note: "Stock initial",
          createdById: user.id,
        },
      });
    }
    return created.id;
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "create",
    entity: "StockItem",
    entityId: id,
    payload: { code: data.code, opening: data.openingQuantity ?? 0 },
  });
  revalidatePath("/[locale]/stock", "page");
  return ok({ id });
}

export async function updateStockItem(
  raw: UpdateStockItemInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...ADMIN_ONLY]);
  const parsed = updateStockItemSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid item", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const existing = await db.stockItem.findFirst({
    where: { id: data.id, clinicId: user.clinicId },
    select: { id: true, code: true },
  });
  if (!existing) return fail("NOT_FOUND", "Item not found");

  if (existing.code !== data.code) {
    const dup = await db.stockItem.findUnique({
      where: { clinicId_code: { clinicId: user.clinicId, code: data.code } },
      select: { id: true },
    });
    if (dup && dup.id !== data.id) {
      return fail("DUPLICATE_CODE", "Code already exists", { code: ["DUPLICATE"] });
    }
  }

  await db.stockItem.update({
    where: { id: data.id },
    data: {
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      unit: data.unit,
      lowStockAt: data.lowStockAt ?? null,
      expiresAt: data.expiresAt ? new Date(`${data.expiresAt}T12:00:00`) : null,
      category: data.category ?? null,
      isActive: data.isActive,
    },
  });

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "update",
    entity: "StockItem",
    entityId: data.id,
  });
  revalidatePath("/[locale]/stock", "page");
  revalidatePath(`/[locale]/stock/${data.id}`, "page");
  return ok({ id: data.id });
}

// ─── Movements ──────────────────────────────────────────────────────────────

/**
 * Records a movement against an item. The action layer signs the quantity
 * based on `type`: CONSUMPTION/RETURN are stored as negative, others positive.
 * An out-of-stock guard prevents negative inventory.
 */
export async function recordMovement(
  raw: RecordMovementInput,
): Promise<Result<{ id: string }>> {
  const user = await requireRole([...ANY_STAFF]);
  const parsed = recordMovementSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Invalid movement", zodFieldsFromError(parsed.error));
  }
  const data = parsed.data;

  const item = await db.stockItem.findFirst({
    where: { id: data.itemId, clinicId: user.clinicId },
    select: { id: true },
  });
  if (!item) return fail("NOT_FOUND", "Item not found");

  const signedQty = OUTGOING_TYPES.has(data.type) ? -data.quantity : data.quantity;
  const recordedAt = data.recordedAt
    ? new Date(`${data.recordedAt}T12:00:00`)
    : new Date();

  // Block movements that would push the stock below zero. We do this under an
  // advisory lock so two concurrent consumptions can't both pass the check.
  const movementId = await db.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${data.itemId}::text))`,
    );
    if (signedQty < 0) {
      const agg = await tx.stockMovement.aggregate({
        where: { itemId: data.itemId },
        _sum: { quantity: true },
      });
      const current = agg._sum.quantity ?? 0;
      if (current + signedQty < 0) {
        throw new Error("INSUFFICIENT_STOCK");
      }
    }
    const m = await tx.stockMovement.create({
      data: {
        clinicId: user.clinicId,
        itemId: data.itemId,
        type: data.type,
        quantity: signedQty,
        unitPrice: data.unitPrice ?? null,
        note: data.note ?? null,
        recordedAt,
        createdById: user.id,
      },
      select: { id: true },
    });
    return m.id;
  }).catch((err) => {
    if (err instanceof Error && err.message === "INSUFFICIENT_STOCK") return "INSUFFICIENT_STOCK";
    throw err;
  });

  if (movementId === "INSUFFICIENT_STOCK") {
    return fail("INSUFFICIENT_STOCK", "Stock would go negative", {
      quantity: ["INSUFFICIENT_STOCK"],
    });
  }

  await audit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "movement",
    entity: "StockItem",
    entityId: data.itemId,
    payload: { type: data.type, signedQty },
  });
  revalidatePath("/[locale]/stock", "page");
  revalidatePath(`/[locale]/stock/${data.itemId}`, "page");
  revalidatePath("/[locale]", "page"); // dashboard low-stock KPI
  return ok({ id: movementId });
}
