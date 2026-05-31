/**
 * Inngest client + function registry.
 *
 * Inngest replaces the legacy Vercel cron jobs with an event-driven
 * pipeline that has:
 *   - automatic retries on failure (exponential backoff)
 *   - a visual debugger ("which functions fired, what they returned")
 *   - step composition (long-running workflows that span minutes/days)
 *
 * The client is global — `import { inngest } from "@/lib/inngest"` from
 * anywhere. Functions are registered by importing this module's
 * `functions` array into `/api/inngest/route.ts`.
 *
 * Dev: run `npx inngest-cli dev -u http://localhost:3000/api/inngest`
 * for the local dashboard. The `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`
 * become required only in prod (Inngest cloud).
 */

import { AppointmentStatus } from "@prisma/client";
import { Inngest } from "inngest";
import { db } from "@/lib/db/client";
import {
  sendJ1ReminderForAppointment,
  sendMorningReminderForAppointment,
} from "@/lib/whatsapp/reminders";
import { sendRecallReminderById } from "@/lib/whatsapp/recalls";

/**
 * Typed event schema — drives autocompletion + payload validation when
 * we `inngest.send(...)` from server actions. Each entry maps an event
 * name to its expected `data` shape. Add new events here when a Server
 * Action starts publishing them so the function handlers get typed args.
 */
export type EventSchema = {
  "appointment.created": {
    data: {
      clinicId: string;
      outboxId: string;
      id: string; // appointment id
      patientId: string;
      dentistId: string;
      startAt: string; // ISO
    };
  };
  "recall.created": {
    data: {
      clinicId: string;
      outboxId: string;
      id: string; // recallReminder id
      patientId: string;
      dueDate: string; // ISO
      kind: string;
    };
  };
  "appointment.cancelled": {
    data: {
      clinicId: string;
      outboxId: string;
      id: string; // appointment id
      patientId: string;
      dentistId: string;
      startAt: string;
      endAt: string;
      isLate?: boolean;
      source?: string;
    };
  };
  // Add more events here as we wire them in:
  // "invoice.emitted": { data: { ... } };
};

// In dev (no INNGEST_EVENT_KEY set), the SDK still refuses to send unless
// we either (a) flip `isDev: true` so it targets http://localhost:8288, or
// (b) hand it a non-empty key. We go with `isDev` based on NODE_ENV +
// missing key, which is exactly what `npx inngest-cli dev` expects.
const isDev = !process.env.INNGEST_EVENT_KEY || process.env.NODE_ENV !== "production";

export const inngest = new Inngest({
  id: "dentalcare",
  isDev,
  // Cloud key — used in prod once we sign up at inngest.com. Optional in dev.
  eventKey: process.env.INNGEST_EVENT_KEY,
  // Inngest typing: the typed `send` is achieved via the `EventSchema`
  // type when callers import this client.
});

/**
 * Demo function for AI-0 — listens for `appointment.created` and logs
 * the payload. Proves the outbox → Inngest pipeline is wired end-to-end.
 *
 * Phase AI-2 will replace this with the actual J-1 reminder logic
 * (compute J-1 date, send WhatsApp template via existing client).
 */
export const onAppointmentCreated = inngest.createFunction(
  {
    id: "appointment-created-canary",
    name: "Appointment created — canary",
    triggers: [{ event: "appointment.created" }],
  },
  async ({ event, step, logger }) => {
    logger.info("appointment.created received", event.data);

    // `step.run` makes the operation idempotent + observable in the
    // Inngest dashboard. If the function retries, this step is skipped
    // when its result is already cached.
    const summary = await step.run("load-appointment", async () => {
      const appt = await db.appointment.findUnique({
        where: { id: event.data.id },
        select: {
          id: true,
          startAt: true,
          status: true,
          patient: { select: { firstName: true, lastName: true } },
          dentist: { select: { firstName: true, lastName: true } },
        },
      });
      return appt
        ? {
            id: appt.id,
            patient: `${appt.patient.firstName} ${appt.patient.lastName}`,
            dentist: `Dr ${appt.dentist.firstName} ${appt.dentist.lastName}`,
            startAt: appt.startAt.toISOString(),
            status: appt.status,
          }
        : null;
    });

    return { ok: true, summary };
  },
);

/**
 * AI-2 — J-1 reminder. Listens for `appointment.created`, sleeps until
 * 24h before the start time, then ships a WhatsApp template reminder
 * via `sendJ1ReminderForAppointment`.
 *
 * Inngest's `step.sleepUntil` is durable: even if Vercel restarts or
 * the Inngest cloud instance reboots, the sleep resumes from the same
 * wakeup time. No cron needed.
 *
 * Idempotency is handled by the reminder helper (returns ALREADY_SENT
 * if `reminderSentAt` is already set), so an at-least-once delivery
 * from Inngest never produces a double-send to the patient.
 *
 * Drift handling: if the appointment was moved after the wake target
 * was computed (re-scheduled, cancelled), the helper returns a typed
 * skip code and we log it as a benign no-op.
 */
export const appointmentJ1Reminder = inngest.createFunction(
  {
    id: "appointment-j1-reminder",
    name: "Appointment J-1 reminder",
    triggers: [{ event: "appointment.created" }],
  },
  async ({ event, step, logger }) => {
    const reminderAt = new Date(
      new Date(event.data.startAt).getTime() - 24 * 60 * 60 * 1000,
    );

    // If the appointment is < 24h away on create (same-day booking),
    // the target is already in the past. Fire as soon as we can — but
    // still through the helper so the audit + idempotence paths run.
    if (reminderAt.getTime() > Date.now()) {
      await step.sleepUntil("wait-until-J-1", reminderAt);
    } else {
      logger.info("appointment.created less than 24h away — sending reminder now", {
        appointmentId: event.data.id,
      });
    }

    const result = await step.run("send-reminder", async () => {
      return sendJ1ReminderForAppointment(event.data.id);
    });

    if (!result.ok) {
      logger.info("J-1 reminder skipped", { appointmentId: event.data.id, reason: result.reason });
    }
    return { ok: true, appointmentId: event.data.id, result };
  },
);

/**
 * AI-3 — Recall reminder. Listens for `recall.created`, sleeps until
 * the recall's `dueDate` (typically 6 to 24 months out for a scaling /
 * annual checkup), then sends the `checkup_reminder` WhatsApp template.
 *
 * Idempotence + appointment-already-booked detection lives in
 * `sendRecallReminderById`, so an Inngest retry never double-sends.
 *
 * Why event-driven over a cron sweep: the cron path scans the entire
 * recall table every morning and is fragile against clock skew or a
 * missed Vercel cron firing. Inngest sleeps are durable across server
 * restarts and surface in the dashboard.
 */
export const recallReminderDueDate = inngest.createFunction(
  {
    id: "recall-reminder-due",
    name: "Recall reminder — due date",
    triggers: [{ event: "recall.created" }],
  },
  async ({ event, step, logger }) => {
    const dueAt = new Date(event.data.dueDate);

    // Some recalls are inserted with a `dueDate` already in the past
    // (e.g. backfilled from old data). In that case fire immediately;
    // the helper handles the "too late" case via its SLACK_DAYS guard.
    if (dueAt.getTime() > Date.now()) {
      await step.sleepUntil("wait-until-due-date", dueAt);
    } else {
      logger.info("recall.created already due — sending immediately", {
        recallId: event.data.id,
      });
    }

    const result = await step.run("send-recall", async () => {
      return sendRecallReminderById(event.data.id);
    });

    if (!result.ok) {
      logger.info("Recall reminder skipped", {
        recallId: event.data.id,
        reason: result.reason,
      });
    }
    return { ok: true, recallId: event.data.id, result };
  },
);

/**
 * AI-4 — Smart cancellation + waitlist auto-promotion. Listens for
 * `appointment.cancelled`, looks up the cancelled slot's dentist +
 * clinic, then calls the existing `proposeSlotToWaitlist` Server
 * Action which: finds matching WAITING entries, flips them to
 * PROPOSED with a 15-min token, and fires the `waitlist_slot_offered`
 * WhatsApp template to each.
 *
 * Why this lives in Inngest instead of inline in the cancel path:
 * cancel happens synchronously in the AI tool (must reply within ~10s
 * to the patient on WhatsApp); the waitlist scan + parallel template
 * sends would add 1-3s and could fail in ways that shouldn't roll back
 * the cancel. Event-driven keeps the cancel path fast + the promotion
 * retriable.
 */
export const waitlistPromoteOnCancel = inngest.createFunction(
  {
    id: "waitlist-promote-on-cancel",
    name: "Waitlist — auto-promote on appointment cancelled",
    triggers: [{ event: "appointment.cancelled" }],
  },
  async ({ event, step, logger }) => {
    const { proposeSlotToWaitlist } = await import(
      "@/server/actions/waitlist"
    );

    // Resolve the dentist + clinic display names — `proposeSlotToWaitlist`
    // needs them for the WhatsApp template body. One round-trip via
    // step.run so retries get a cached result.
    const ctx = await step.run("load-cancel-context", async () => {
      const [dentist, clinic] = await Promise.all([
        db.dentist.findUnique({
          where: { id: event.data.dentistId },
          select: { firstName: true, lastName: true },
        }),
        db.clinic.findUnique({
          where: { id: event.data.clinicId },
          select: { name: true },
        }),
      ]);
      return {
        dentistName: dentist ? `${dentist.firstName} ${dentist.lastName}` : "—",
        clinicName: clinic?.name ?? "—",
      };
    });

    const result = await step.run("propose-to-waitlist", async () => {
      return proposeSlotToWaitlist({
        clinicId: event.data.clinicId,
        dentistId: event.data.dentistId,
        dentistName: ctx.dentistName,
        clinicName: ctx.clinicName,
        startAt: new Date(event.data.startAt),
        endAt: new Date(event.data.endAt),
      });
    });

    logger.info("waitlist propose result", {
      appointmentId: event.data.id,
      proposed: result.proposedCount,
    });
    return { ok: true, proposed: result.proposedCount };
  },
);

/**
 * Daily 08:00 Casablanca morning-of reminder sweep.
 *
 * Casablanca = UTC+1, no DST since 2018. So 08:00 local = 07:00 UTC.
 * The cron fires every day, queries appointments scheduled for "today"
 * in Casablanca, and triggers `sendMorningReminderForAppointment` on
 * each. This runs IN PARALLEL with the per-appointment J-1 reminder
 * so the same patient with an afternoon RDV gets both reminders:
 *   - J-1 the day before (24h ahead at appointment time)
 *   - morning-of at 08:00 the same day
 *
 * The helper carries its own `morningReminderSentAt` idempotence so
 * Inngest retries can't double-send within the same day, and a
 * possible early/late cron firing still produces a single message.
 *
 * Multi-tenant: scans across all clinics; no clinic filter. Each
 * appointment row carries its own `clinicId` which the helper uses
 * downstream for the audit log.
 */
export const dailyMorningRemindersSweep = inngest.createFunction(
  {
    id: "daily-morning-reminders",
    name: "Daily 08:00 morning reminders (Casablanca)",
    triggers: [{ cron: "TZ=Africa/Casablanca 0 8 * * *" }],
  },
  async ({ step, logger }) => {
    // Compute the Casablanca-local "today" window in UTC. Morocco is
    // UTC+1 year-round (no DST since 2018), so today's window starts
    // at the most-recent 00:00 Casablanca = previous 23:00 UTC.
    const now = new Date();
    const localTodayStart = new Date(now);
    localTodayStart.setUTCHours(-1, 0, 0, 0); // 23:00 UTC previous day = 00:00 Casa
    if (localTodayStart > now) {
      // Edge case: cron fired right after midnight UTC — backtrack.
      localTodayStart.setUTCDate(localTodayStart.getUTCDate() - 1);
    }
    const localTodayEnd = new Date(localTodayStart);
    localTodayEnd.setUTCDate(localTodayEnd.getUTCDate() + 1);

    const candidates = await step.run("load-candidates", async () => {
      return db.appointment.findMany({
        where: {
          startAt: { gte: localTodayStart, lt: localTodayEnd },
          status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
          morningReminderSentAt: null,
        },
        select: { id: true, clinicId: true },
      });
    });

    logger.info("morning-reminders sweep", {
      candidates: candidates.length,
      windowStart: localTodayStart.toISOString(),
      windowEnd: localTodayEnd.toISOString(),
    });

    // Fan out — each send is its own step so a single failure doesn't
    // block the rest of the sweep, and Inngest retries only the loser.
    const results = await Promise.all(
      candidates.map((c) =>
        step.run(`send-morning-${c.id}`, async () =>
          sendMorningReminderForAppointment(c.id),
        ),
      ),
    );

    const sent = results.filter((r) => r.ok).length;
    const skipped = results.length - sent;
    return { ok: true, candidates: candidates.length, sent, skipped };
  },
);

/**
 * Ordered list of functions to serve at `/api/inngest`. New functions
 * must be added here AND exported from this file.
 */
export const functions = [
  onAppointmentCreated,
  appointmentJ1Reminder,
  recallReminderDueDate,
  waitlistPromoteOnCancel,
  dailyMorningRemindersSweep,
];
