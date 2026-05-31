# WhatsApp Cloud API — Setup guide

End-to-end install steps for the WhatsApp booking + reminder pipeline,
from creating the Meta app to running the bot against a real number.

The reader is assumed to have a Meta / Facebook account and admin rights
on the deployment.

## What we wire up

| Capability | Component | Tested by |
|---|---|---|
| Inbound text → AI booking flow | `/api/webhooks/whatsapp` route | `pnpm tsx scripts/test-ai-webhook.ts` |
| Bot reply → patient WhatsApp | `sendText` in `src/lib/whatsapp/client.ts` | live test |
| J-1 RDV reminders | `appointmentJ1Reminder` Inngest function + `appointment_reminder` template | `pnpm tsx scripts/test-ai-2.ts` |
| Patient recalls (detartrage etc.) | `recallReminderDueDate` Inngest function + `checkup_reminder` template | live cron run |

## Phase 1 — Meta for Developers app (5 min)

1. <https://developers.facebook.com/> → log in → **My Apps** → **Create App**.
2. Use case → **Other** → Type → **Business** → name `DentalCare`,
   email = ops contact.
3. App dashboard → **Add Product** → **WhatsApp** → **Set up**.
4. Create or pick a Business Portfolio (Meta auto-creates one).

You now have a "Test Number" (e.g. `+1 555-652-4242`) at no charge.

## Phase 2 — Collect 4 credentials → `.env`

On **WhatsApp → Configuration de l'API**:

| `.env` key | Where to find it |
|---|---|
| `WHATSAPP_PHONE_ID` | "Phone number ID" under **From** |
| `WHATSAPP_TOKEN` | "Temporary access token" (24h validity, regenerate as needed for dev) |
| `WHATSAPP_APP_SECRET` | App settings → **Basic** → **App Secret** → Show |
| `WHATSAPP_VERIFY_TOKEN` | **You choose** — any string, e.g. `dental-verify-9f3a2k` |

For production: use a **System User token** (permanent) instead of the
24h temporary token. Generate one via Business Settings → System Users →
Add → assign WhatsApp permission → "Generate new token".

Validate everything with the pre-flight script:

```powershell
pnpm tsx scripts/verify-whatsapp-creds.ts
```

It hits Meta Graph with each cred independently — a green line per check
means the next phase is safe to attempt.

## Phase 3 — Add tester phones (dev mode only)

In dev mode, Meta only delivers outbound messages to numbers explicitly
allowed:

1. **Configuration de l'API** → section **To** → **Manage phone number list**.
2. Click **Add phone number** → enter `+212XXXXXXXXX` → choose
   **WhatsApp** code delivery → enter the 6-digit code received.

⚠️ The dialog **"Add WhatsApp phone number"** (under the left nav
"Connect your phone number") is for **transferring your personal WhatsApp
to Meta Cloud** — different flow, do not use for testing.

## Phase 4 — Expose localhost via ngrok

Meta requires HTTPS for the webhook. ngrok is the simplest path in dev:

```powershell
# Install
winget install ngrok.ngrok

# Authtoken (free account on ngrok.com)
ngrok config add-authtoken <YOUR_AUTHTOKEN>

# Start tunnel — leave window open
ngrok http 3000
```

Note the `Forwarding https://<random>.ngrok-free.dev → http://localhost:3000`
URL. You will paste it into Meta in the next phase.

Free tier note: the URL changes on every ngrok restart. The ngrok dashboard
also offers one reserved domain per free account — useful so you don't have
to update Meta's webhook URL every day.

## Phase 5 — Configure the webhook in Meta

1. Meta → **WhatsApp → Configuration** → section **Webhook** → **Edit**.
2. **Callback URL** = `https://<your-ngrok>.ngrok-free.dev/api/webhooks/whatsapp`
3. **Verify token** = exactly the `WHATSAPP_VERIFY_TOKEN` value from `.env`.
4. Click **Vérifier et enregistrer** — Meta does a GET handshake → ✅ green.
5. Section **Webhook fields** → **Manage** → **subscribe to `messages`** → Done.

Common failure: the dev server is down → Meta returns "URL not verifiable".
Start `pnpm dev` and `ngrok http 3000` *before* clicking the button.

## Phase 6 — Run the stack

Three terminals (keep them open during the session):

```powershell
# 1) Tunnel
ngrok http 3000

# 2) Next.js
pnpm dev

# 3) Inngest dev server (durable sleeps + dashboard at http://localhost:8288)
npx inngest-cli dev -u http://localhost:3000/api/inngest
```

## Phase 7 — Smoke tests in order

```powershell
# Sanity: token + secret + signature round-trip
pnpm tsx scripts/verify-whatsapp-creds.ts

# Send a hello_world template to ensure outbound works
pnpm tsx scripts/test-whatsapp-send.ts +212XXXXXXXXX

# End-to-end engine without HTTP (booking flow + DB writes)
pnpm tsx scripts/test-ai-webhook.ts

# AI-2 J-1 reminder pipeline (creates a fake appointment 90 min ahead,
# Inngest fires the reminder almost immediately)
pnpm tsx scripts/test-ai-2.ts
```

Live test from your phone:

1. WhatsApp → new chat with the test number (e.g. `+1 555 652 4242`).
2. Send `Bonjour, vous êtes ouverts mardi ?` → bot replies with hours.
3. Send `je voudrais un RDV jeudi matin` → bot proposes slots.
4. Send a slot → RDV created in DB; verify via `/appointments` (it will
   carry the green "IA" pill thanks to `source: AI_WHATSAPP`).

## Phase 8 — Templates (production-only blocker)

Free-form text replies only work inside the 24h customer-care window
opened by the patient's inbound message. Outbound notifications outside
that window MUST go through a **pre-approved template**:

| Template name (Meta) | Used by | Status |
|---|---|---|
| `appointment_reminder` | `appointmentJ1Reminder` Inngest function | Create in Meta UI, see `docs/whatsapp-templates.md` |
| `checkup_reminder` | `recallReminderDueDate` Inngest function | Same |
| `waitlist_slot_offered` | Waitlist proposal flow | Same |
| `payment_due` | Payment plan reminders | Same |

Each template:

1. Meta → **WhatsApp → Message Templates** → **Create**.
2. Category = **Utility** (free, ~24h approval).
3. Name + body + variable order must match `src/lib/whatsapp/templates.ts`
   declarations — those types drive the Meta API payload at runtime.
4. Submit → wait for green check.

Without the templates approved, `sendTemplate` returns error
`(#132001) Template name does not exist`, which the helpers surface in
the audit log under `appointment.reminder.failed` / `recall.send_failed`.
The `/reminders-queue` admin page lists these failures so cabinets can
diagnose without DB access.

## Phase 9 — Production hardening

Before going live with a real cabinet phone:

- Replace the 24h **Temporary access token** with a **System User token**.
- Move `WHATSAPP_*` env vars to Vercel project settings (not `.env`).
- Migrate webhook URL from `<ngrok>.ngrok-free.dev` to
  `https://<production-domain>/api/webhooks/whatsapp`.
- Submit the app for Meta review (toggle "Live mode" once verified).
  Until that's done, only numbers on the test allowlist receive messages
  — every other patient gets a silent drop (visible in
  `/reminders-queue` as `ai.conversation.send_failed`).
- Move Inngest from dev mode to **Inngest Cloud** — set
  `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` in Vercel.

## Troubleshooting cheatsheet

| Symptom | Likely cause / fix |
|---|---|
| Meta rejects "Vérifier et enregistrer" | Dev server down or verify token mismatch. Check ngrok dashboard at `http://localhost:4040` for the request and our response body. |
| Bot doesn't reply to a tester | Their number isn't in the To allowlist OR the 24h window is closed and the template isn't approved. Check the `ai.conversation.send_failed` audit row. |
| `(#190) Authentication Error` | `WHATSAPP_TOKEN` expired (24h temp tokens). Regenerate on **Configuration de l'API**. |
| `(#132001) Template name does not exist` | The template is not yet approved on Meta. Create it under Message Templates with the exact name from `src/lib/whatsapp/templates.ts`. |
| Inngest functions don't fire | The CLI isn't running OR `INNGEST_EVENT_KEY` is set but pointing at cloud while running locally. The client switches to `isDev: true` when `NODE_ENV !== "production"`. |
