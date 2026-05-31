# AI & Automation — Implementation Plan (DentalCare V2)

> Status: 📝 Proposal — to schedule once the design refresh is shipped.
> Architecture: keep the current Next.js + Auth.js + Neon + Vercel stack.
> Defer the full `saas cabinet` migration (see `saas-cabinet-migration.md`).

## Goal

Make patient communication **conversational** and **automatic** :

- A patient texts the cabinet on WhatsApp in natural French / Arabic /
  Darija and the system books, moves, or cancels the appointment without
  human intervention.
- Reminders, follow-ups and dunning workflows run on an **event-driven
  scheduler** that retries on failure and surfaces errors in a dashboard,
  instead of brittle Vercel cron routes.

## Non-goals

- ❌ Pay for Claude / GPT-4 — keep the AI free tier (Gemini Flash 1500
  req/day → Groq Llama 3.3 70B fallback). Total LLM cost target: **0 DH /
  cabinet / month**.
- ❌ Rewrite to tRPC. Server Actions stay.
- ❌ Migrate DB to Supabase. Neon stays.
- ❌ Self-host n8n on a VPS. We use **Inngest** instead — it's a managed
  event orchestrator that runs on Vercel and has the same "workflow with
  retries" semantics, free up to 50k events/month.
- ❌ React Native mobile app. PWA stays.

## Tech additions

| Package | Role | Cost |
|---|---|---|
| `@google/generative-ai` | Gemini 2.0 Flash SDK (primary) | Free 1500 req/day |
| `groq-sdk` | Groq Llama 3.3 70B (fallback) | Free tier |
| `inngest` | Event-driven workflows on Vercel | Free 50k events/mo |
| `@inngest/next` | Next.js handler for Inngest | (included) |

Existing — kept:
- WhatsApp Cloud API (Meta) — outbound templates already work
- Resend — for transactional email
- Cloudinary — radiographs, photos, PDFs
- Sentry — error monitoring

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Patient (WhatsApp / web portal)                    │
└────────────┬──────────────────────────────────────┬─────────────────┘
             │ message inbound                       │ web actions
             ▼                                       ▼
┌──────────────────────────┐         ┌─────────────────────────────┐
│  /api/webhooks/whatsapp  │         │  Server Actions             │
│  (Meta sends here)       │         │  createAppointment(...)     │
└────────────┬─────────────┘         │  cancelAppointment(...)     │
             │                       └────────────┬────────────────┘
             ▼                                    │
┌──────────────────────────┐                      │ publishEvent("..", payload)
│  AICascadeProvider       │                      │ in same Prisma transaction
│  Gemini Flash → Groq     │                      ▼
│  function-calling tools  │             ┌─────────────────────────┐
│  validated by zod        │             │   EventOutbox table     │
└────────────┬─────────────┘             │   (Prisma)              │
             │                           └────────────┬────────────┘
             ▼                                        │
       resolve → tools                                │ async dispatcher
       e.g. searchSlots() → createAppointment()       │ (Inngest webhook)
             │                                        ▼
             │                          ┌──────────────────────────┐
             └─────────────────────────►│  Inngest functions       │
                                        │  - sendJ1Reminder        │
                                        │  - dunningPaymentPlan    │
                                        │  - generateRecall        │
                                        │  - notifyWaitlist        │
                                        │  Each has retries +      │
                                        │  visual debug.           │
                                        └──────────────────────────┘
```

## Phases

### Phase 1 — Foundation (≈ 1 week)

**Deliverables**

- `src/lib/ai/provider.ts` — `AIProvider` interface with `chat()` and
  `streamChat()` methods, function-calling support, JSON output mode.
- `src/lib/ai/gemini.ts` — Implementation against `@google/generative-ai`.
- `src/lib/ai/groq.ts` — Fallback implementation against `groq-sdk`.
- `src/lib/ai/cascade.ts` — `AICascadeProvider` that wraps both, fails
  over from Gemini → Groq on 429 / 5xx / timeout > 8s.
- `EventOutbox` Prisma model + `publishEvent()` helper that inserts a
  row in the same transaction as the calling Server Action.
- Inngest config + `/api/inngest/route.ts` handler.
- 1 demo Inngest function that consumes `EventOutbox` rows and logs.

**Acceptance**
- `pnpm test ai-cascade` simulates a Gemini 429 → fallback to Groq → reply.
- Creating an appointment writes a row in `EventOutbox` AND triggers an
  Inngest run within 10s.

**No user-visible change yet.** Pure plumbing.

### Phase 2 — WhatsApp AI Booking (≈ 2 weeks)

**The killer feature.** Patient texts "Je voudrais un RDV demain matin"
and the system books it.

**Deliverables**

- Extend `/api/webhooks/whatsapp` to handle text-message events (not just
  template confirmations).
- New session model `AIConversation` keyed by (clinicId, patientPhone)
  to track context across multiple messages.
- Tools exposed to the AI (each validates input with zod):
  - `getCabinetInfo()` → hours, dentists list
  - `searchAvailableSlots(dentistId?, dateRange, durationMin)`
  - `createAppointment(patientId, dentistId, startAt, reason)`
  - `cancelAppointment(appointmentId, reason)`
  - `rescheduleAppointment(appointmentId, newStartAt)`
  - `listMyAppointments(patientPhone)` → patient's upcoming RDV
- System prompt tuned for a dental cabinet voice — reassuring,
  precise, escalates on pain/trauma keywords.
- Audit log entry on every AI-initiated booking.

**Acceptance**
- E2E test (Vitest + msw mocking Gemini) :
  "Je voudrais un RDV avec Dr Hdoude jeudi prochain" → AI proposes 3
  slots → patient picks "celui de 14h" → AI creates appointment → DB row
  exists with `source = "AI_WHATSAPP"`.
- Failed parse (e.g. patient says "je veux annuler" without context) →
  AI asks a clarifying question, doesn't crash.

### Phase 3 — Replace Vercel crons with Inngest (≈ 1 week)

**Deliverables**

- New Inngest functions :
  - `appointment.j1Reminder` — fires daily at 17:00 UTC (= 18h Maroc),
    sends J-1 WhatsApp.
  - `paymentPlan.j3Reminder` / `paymentPlan.j1Reminder` — payment plan
    dunning.
  - `recall.weeklyDispatch` — recall reminders.
- Remove `vercel.json` cron config and the 3 routes under `/api/cron/*`.
- Inngest dashboard becomes the source of truth for "did the reminder
  fire?".

**Acceptance**
- Same WhatsApp templates sent as today, same timing (within ±5 min).
- Inngest dashboard shows each run with input/output/duration.
- Failed runs auto-retry 3× with exponential backoff (vs. the current
  "fire and forget" cron).

### Phase 4 — Smart reschedule on cancellation (≈ 1 week)

**Deliverables**

- Patient replies "Je ne peux pas demain" to a J-1 reminder → webhook
  invokes `AIConversation` with cancellation intent → AI:
  1. Cancels the existing RDV (after confirmation).
  2. Offers 3 alternative slots from the same dentist that week.
  3. Books the chosen one.
- The freed slot is auto-offered to the **first matching waitlist entry**
  for that dentist + time window.

**Acceptance**
- A real cancellation flow tested end-to-end : RDV cancelled, replacement
  RDV created, waitlist entry promoted.

### Phase 5 — Urgency triage (≈ 3 days)

**Deliverables**

- AI detects keywords (douleur, saigne, casse, ne mange plus, fièvre) in
  inbound messages → flags `URGENCE` → :
  - Offers the next emergency slot in the dentist's schedule (≤ 24h).
  - Sends a Sentry-tagged notification to the dentist on call.
- Visible "🚨 Urgences" filter on `/appointments`.

### Phase 6 — Voice notes (optional, ≈ 1 week)

Patients in Maghreb send voice notes a lot. Gemini Flash supports audio
input directly. Transcribe → reuse the same booking pipeline.

## Sprint plan

| Sprint | Phase | Weeks |
|---|---|---|
| AI-0 | Foundation (provider + outbox + inngest skeleton) | 1 |
| AI-1 | WhatsApp AI booking (read-only first, then mutations) | 2 |
| AI-2 | Cron → Inngest migration | 1 |
| AI-3 | Smart cancel + waitlist auto-promotion | 1 |
| AI-4 | Urgence triage | 0.5 |
| AI-5 | Voice notes (optional) | 1 |

**Total**: ~6.5 weeks of focused work. **NOT urgent** — the V1 sells
without any of this. The trigger to start is "≥ 5 paying cabinets are
asking for it" or "a prospect wants WhatsApp booking enough to pay
extra".

## Risk register

| Risk | Mitigation |
|---|---|
| Gemini Flash daily quota (1500 req) hit | Cascade to Groq at 70% utilisation; clinics rarely send > 50 messages/day |
| AI hallucinates and books wrong slot | Every tool input revalidated by zod server-side; AI can only call tools, not write DB directly |
| WhatsApp inbound webhook stops working | Inngest can act as canary — if no inbound webhook for 24h while crons fired, alert ops |
| Inngest free tier exhausted | 50k events/month = ~1600/day. Cabinet with 30 RDV/day = ~300 events. Room for 5 cabinets on one Inngest account. Beyond that, upgrade to $20/mo |
| Patient confusion ("the bot doesn't understand") | Always offer "→ Parler à une vraie personne" escape hatch that pings the receptionist |

## Decision points to validate before starting

1. **Inngest vs n8n** : we go Inngest (managed, runs on Vercel, no
   infra). Alt: self-host n8n on Railway (~5€/mo) if we want full control.
2. **Conversation memory** : in-DB Prisma table (`AIConversation`),
   purged after 30 days. No vector store needed for booking — pure
   function-calling.
3. **Language detection** : let Gemini auto-detect; system prompt
   instructs it to reply in the same language as the patient (FR / EN /
   AR / Darija).
4. **Privacy** : DO NOT send the patient's full medical history to the
   LLM. Only send : first name, last RDV date, upcoming RDV summary,
   dentist names. Send the LLM a **redacted** snapshot.
5. **Audit** : every AI action writes to `audit_log` with
   `action: "ai.appointment.create"`, `payload: { model, prompt_tokens,
   completion_tokens, latency_ms, tool_calls }`.

## What we ship per phase

| Phase | What user sees | What changes in code |
|---|---|---|
| AI-0 | Nothing | `lib/ai/`, `EventOutbox` table, Inngest skeleton |
| AI-1 | Patient can book via WhatsApp text | Webhook handler + tools |
| AI-2 | Nothing (reminders still arrive) | `vercel.json` crons removed |
| AI-3 | Cancellation by message works | Conversation extension |
| AI-4 | Urgency triage UI | `/appointments?urgent=true` |
| AI-5 | Patient sends voice → RDV | Audio input pipeline |
