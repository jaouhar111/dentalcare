/**
 * Transactional event publishing — the **outbox pattern**.
 *
 * # Why this exists
 *
 * The naïve approach is to call Inngest directly from a Server Action:
 *
 *     await db.appointment.create(...);
 *     await inngest.send({ name: "appointment.created", data: ... });  // ❌
 *
 * Two race conditions kill that:
 *   1. The DB transaction can roll back AFTER the Inngest call — now an
 *      Inngest function is processing an appointment that doesn't exist.
 *   2. If the Inngest HTTP call fails, the DB write succeeded but the
 *      downstream pipeline never fires.
 *
 * The outbox pattern fixes both:
 *   - `publishEvent` inserts a `PENDING` row in `event_outbox` inside the
 *     SAME transaction as the business mutation. Either both commit or
 *     neither does.
 *   - A post-commit dispatcher (called once at the end of the Server
 *     Action) reads the PENDING rows and forwards them to Inngest. If
 *     forwarding fails, the row stays PENDING and the next dispatch run
 *     (or manual replay) picks it up.
 *
 * # Usage
 *
 *     await db.$transaction(async (tx) => {
 *       const appt = await tx.appointment.create({ ... });
 *       await publishEvent(tx, {
 *         clinicId,
 *         name: "appointment.created",
 *         payload: { id: appt.id, startAt: appt.startAt.toISOString() },
 *       });
 *     });
 *     // After commit (Prisma resolves), call the dispatcher once.
 *     await dispatchPendingEvents();
 *
 * `dispatchPendingEvents()` is best-effort fire-and-forget — failures
 * stay in the outbox and a future dispatch (e.g. a periodic Inngest cron
 * inspecting the outbox) replays them.
 */

import { type Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { inngest } from "./inngest";

interface PublishEventArgs {
  clinicId: string;
  name: string;
  payload: Record<string, unknown>;
}

/**
 * Insert an event in the outbox. Must be called inside a `db.$transaction`
 * so the row is atomic with the business mutation.
 */
export async function publishEvent(
  tx: Prisma.TransactionClient,
  args: PublishEventArgs,
): Promise<{ id: string }> {
  const row = await tx.eventOutbox.create({
    data: {
      clinicId: args.clinicId,
      name: args.name,
      payloadJson: args.payload as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  return row;
}

/**
 * Forward all PENDING outbox rows to Inngest. Updates row status on
 * success; on failure leaves them PENDING and records `lastError`.
 *
 * Caller pattern: call once at the end of every Server Action that
 * published events. Idempotent — safe to call extra times.
 */
export async function dispatchPendingEvents(limit = 50): Promise<{
  dispatched: number;
  failed: number;
}> {
  const pending = await db.eventOutbox.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let dispatched = 0;
  let failed = 0;
  for (const row of pending) {
    try {
      await inngest.send({
        name: row.name,
        data: {
          clinicId: row.clinicId,
          outboxId: row.id,
          ...(row.payloadJson as Record<string, unknown>),
        },
      });
      await db.eventOutbox.update({
        where: { id: row.id },
        data: { status: "DISPATCHED", dispatchedAt: new Date() },
      });
      dispatched++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db.eventOutbox.update({
        where: { id: row.id },
        data: {
          attempts: { increment: 1 },
          lastError: message.slice(0, 500),
          // After 5 failed attempts mark FAILED so the admin can replay manually.
          status: row.attempts + 1 >= 5 ? "FAILED" : "PENDING",
        },
      });
      failed++;
    }
  }
  return { dispatched, failed };
}
