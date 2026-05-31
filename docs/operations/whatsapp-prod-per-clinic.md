# WhatsApp Cloud API — Per-clinic production onboarding

End-to-end checklist for activating WhatsApp on a **new cabinet in
production**. The DentalCare platform is multi-tenant: a single Vercel
deployment serves every clinic, and the WhatsApp webhook routes each
inbound message to the right clinic by `metaPhoneNumberId`.

This means you only need to do the **Phase 0** (one-time, platform-wide)
setup once, then **Phase 1 → Phase 4** for each new cabinet you onboard.

---

## Phase 0 — Platform-wide (done once)

Already in place if the platform is live. Sanity-check these before
onboarding the first paying cabinet:

| Item | Where | Required value |
|---|---|---|
| Production webhook URL | Vercel env `NEXTAUTH_URL` | `https://your-domain.com` |
| Inngest cloud keys | Vercel env | `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` |
| Meta App Secret | Vercel env `WHATSAPP_APP_SECRET` | from Meta App → Basic → App Secret |
| Meta Verify Token | Vercel env `WHATSAPP_VERIFY_TOKEN` | a single shared string for all clinics |
| Platform fallback phone | Vercel env `WHATSAPP_PHONE_ID` + `WHATSAPP_TOKEN` | the cabinet otmane test number, used when `metaPhoneNumberId` lookup fails |

The webhook signature is verified by `WHATSAPP_APP_SECRET` for **every
cabinet** — Meta signs the request with your single app secret, and the
clinic resolution happens **after** signature validation by reading the
`entry[].changes[].value.metadata.phone_number_id` field.

---

## Phase 1 — Add the cabinet's WhatsApp number to your Meta WABA

Each cabinet's WhatsApp Business number must be **owned by your Meta
Business Portfolio** (the cabinet doesn't need their own Meta account):

1. Meta Business Manager → **WhatsApp Manager** → **Add phone number**.
2. Pick **"Use a number my business owns"** OR migrate the cabinet's
   existing personal WhatsApp number (the cabinet must accept a Meta
   migration code on their phone — takes 5 min).
3. Verify via SMS / voice code.
4. Once added, the number shows up on the WhatsApp Manager dashboard
   with its own **Phone Number ID** (a 15-digit string).

> **Cost**: First 1 000 service conversations/month are free per WABA.
> Above that, each conversation initiated by the cabinet within the
> 24h customer-care window costs ~$0.005-0.014 depending on the country
> (Morocco = $0.0091/utility conv. at time of writing).

---

## Phase 2 — Bind the Phone Number ID to the cabinet in the DB

Two ways — pick whichever is faster:

### Option A — via the super-admin UI (recommended)

1. Login as `SUPER_ADMIN`.
2. Go to `/super-admin/clinics/{clinicId}`.
3. Field **WhatsApp Phone ID** → paste the 15-digit ID from Meta.
4. Save.

### Option B — via the one-shot script

```powershell
# Edit `scripts/bind-clinic-whatsapp.ts` to target the right clinic,
# OR set WHATSAPP_PHONE_ID env and the first clinic gets bound:
$env:WHATSAPP_PHONE_ID = "123456789012345"
pnpm tsx scripts/bind-clinic-whatsapp.ts
```

> **What happens internally**: every webhook hit triggers
> `resolveClinic(metaPhoneNumberId)` in `src/lib/whatsapp/route-clinic.ts`.
> If `whatsappPhoneId` matches, the inbound message is bound to that
> clinic for the rest of the request (audit log, AI conversation,
> appointment writes). If it doesn't match, the fallback `clinicId`
> from `WHATSAPP_PHONE_ID` env is used — useful for the platform's own
> test number.

---

## Phase 3 — Subscribe the webhook (per phone)

Each WhatsApp phone number needs the webhook re-subscribed (it isn't
inherited from app-level config):

1. Meta App Dashboard → **WhatsApp → Configuration**.
2. **Webhook** section → **Callback URL** = `https://your-domain.com/api/webhooks/whatsapp`.
3. **Verify Token** = the platform's `WHATSAPP_VERIFY_TOKEN`.
4. Click **Vérifier et enregistrer** → green check.
5. **Webhook fields** → **Manage** → tick **`messages`** → Save.
6. ⚠️ Repeat for **every** phone number you add to the WABA — Meta does
   NOT auto-subscribe new numbers to the app-level webhook.

If the cabinet has multiple phones (e.g. one per dentist), each one
needs its own row in the DB with a distinct `Clinic.whatsappPhoneId`
— OR you point them all at the same `clinicId` and merge inbox.

---

## Phase 4 — Get the cabinet's templates approved

Templates are scoped to a **WABA, not a phone number**. So submit them
once on your WABA and every cabinet phone under that WABA can use them.

If you have a separate WABA per cabinet (rare — only if the cabinet
demands their own brand), you must re-submit per WABA.

For each of the 4 templates (`appointment_reminder`, `checkup_reminder`,
`waitlist_slot_offered`, `payment_due`):

1. Meta → **WhatsApp Manager** → **Message templates** → **Create**.
2. **Category** = **Utility** (free, ~24h approval; not Marketing — that
   triggers per-conversation fees + opt-in requirements).
3. **Name** = exactly `appointment_reminder` (must match
   `src/lib/whatsapp/templates.ts`).
4. **Body** = paste from `docs/whatsapp-templates.md` (FR + EN per template).
5. Submit → wait for green check (usually < 24h).

> Until templates are approved, the helpers fallback to **plain text**
> within the patient's 24h customer-care window. Outside that window,
> `sendTemplate` returns `(#132001) Template name does not exist` and
> the message is dropped (visible in `/reminders-queue` as a failure).

---

## Phase 5 — Smoke-test with the cabinet's number

From a different phone (not the cabinet's WhatsApp), send a message to
the cabinet's number:

```
Bonjour, vous êtes ouverts mardi ?
```

Expected:
- The platform's webhook hits.
- `resolveClinic(phoneNumberId)` returns the right `clinicId`.
- The AI engine reads **that clinic's** opening hours and replies.
- A new row appears in `/conversations` for that cabinet (NOT for any other).
- The audit log records `ai.conversation.received` with `clinicId`.

If the reply doesn't arrive:

| Symptom | Likely cause |
|---|---|
| Webhook returns 200 but no reply | Tester phone not in Meta's allowlist (Live mode not enabled) |
| `(#190) Authentication Error` | Token expired or wrong (System User token rotates if cabinet revokes app access) |
| `(#131030) Recipient phone number not in allowed list` | App is in dev mode — go to **App Review** and submit for Advanced Access on `whatsapp_business_messaging` |
| `(#132001) Template not found` | Template approval not finalized for this WABA |
| Webhook returns 401 | `WHATSAPP_APP_SECRET` mismatch — Meta signs with app secret, not the per-number token |

---

## Phase 6 — Enable J-1 + morning-of reminders

These are wired automatically as soon as a `Clinic.whatsappPhoneId` is
set:

- **J-1 reminder** (per-RDV): fires 24 h before each `startAt` via
  Inngest event `appointment.created`. Code:
  `appointmentJ1Reminder` in `src/lib/inngest.ts`.
- **Morning-of reminder** (cron 08:00 Casablanca): scans today's RDVs,
  sends a second reminder. Code: `dailyMorningRemindersSweep`.

Neither needs cabinet-level toggle. To pause for a cabinet:
- Set the cabinet's `subscriptionStatus` to `CANCELLED` — both functions
  short-circuit on inactive clinics (TODO if not yet done).
- Or set `Clinic.whatsappPhoneId = null` — outgoing sends will fail and
  the audit log will record the skip.

---

## Production hardening checklist (do once before first paying cabinet)

- [ ] Replace 24h **Temporary token** with **System User token** (never expires)
- [ ] Vercel env: rotate `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_TOKEN`
- [ ] Webhook URL points to `https://your-domain.com/api/webhooks/whatsapp`
- [ ] App Review submitted: `whatsapp_business_messaging` → **Advanced Access**
- [ ] All 4 templates approved on the prod WABA
- [ ] Inngest Cloud: `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` set in Vercel
- [ ] Sentry / observability: monitor `appointment.reminder.failed` audit rows
- [ ] Billing webhook → set `Clinic.subscriptionStatus` from Stripe events
- [ ] Document the rotation calendar (see `docs/operations/security-rotation.md`)

---

## Quick reference — environment vars

| Var | Scope | Value |
|---|---|---|
| `WHATSAPP_PHONE_ID` | platform fallback | dev/test number ID |
| `WHATSAPP_TOKEN` | platform | System User token (no expiry) |
| `WHATSAPP_APP_SECRET` | platform | Meta App → Basic → App Secret |
| `WHATSAPP_VERIFY_TOKEN` | platform | self-chosen, must match Meta webhook config |
| `INNGEST_EVENT_KEY` | platform | from Inngest Cloud dashboard |
| `INNGEST_SIGNING_KEY` | platform | from Inngest Cloud dashboard |

Per-clinic data (in DB, NOT in env):

| Field | Where | Notes |
|---|---|---|
| `Clinic.whatsappPhoneId` | Prisma | the 15-digit Meta Phone Number ID |
| `Clinic.subscriptionStatus` | Prisma | `ACTIVE` allows sends, `PAST_DUE` blocks them |
| `Clinic.trialEndsAt` | Prisma | enforced by the paywall guard |
