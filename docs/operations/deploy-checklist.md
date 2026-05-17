# Production Deploy Checklist

End-to-end checklist for shipping DentalCare from `localhost:3000` to a real
cabinet on `https://<your-domain>.ma`. Follow it top to bottom the first time;
later deploys only need steps marked **(every deploy)**.

---

## 1. Domain + DNS

- [ ] Purchase a domain. `.ma` via Genious or ANRT (~150 DH/year), `.com`
      via Cloudflare/Namecheap.
- [ ] Point the apex record (`@`) at Vercel (`76.76.21.21`) and `www`
      CNAME to `cname.vercel-dns.com`.
- [ ] Wait for propagation (5–60 min). Test with
      `nslookup your-domain.ma 1.1.1.1`.

## 2. Cloudflare / proxy (optional but recommended)

- [ ] Add the domain to Cloudflare; set DNS to **Proxied** (orange cloud).
- [ ] SSL mode: **Full (strict)**.
- [ ] Always-Use-HTTPS: **on**.
- [ ] Rules → Page Rules: cache `/_next/static/*` aggressively.

## 3. Vercel project setup

- [ ] `vercel link` from the project root (or import via the dashboard).
- [ ] Production branch: `main`. Preview branches: all others (limits Sentry
      noise and Cloudinary uploads from feature branches).
- [ ] Region: `cdg1` (Paris) — closest to Casablanca.
- [ ] Connect the custom domain under Settings → Domains.

## 4. Database (Neon)

- [ ] Create a **production** project in Neon (separate from dev).
- [ ] Add `DATABASE_URL` (pooler) + `DIRECT_URL` (direct) as Vercel env vars
      — scope to **Production** only.
- [ ] Run `pnpm db:deploy` once locally pointed at prod, or hook it into
      Vercel build via `prisma migrate deploy` (already in `postinstall`).
- [ ] Seed an initial admin: `tsx prisma/seed.ts --prod` (script accepts
      `SEED_ADMIN_*` env vars to scope what gets inserted).
- [ ] Verify branching is enabled (Neon → Settings → Branches). Restore
      drill: see `backup-restore.md`.

## 5. Cloudinary

- [ ] Production account separate from dev (avoids quota cross-pollution).
- [ ] Settings → Security:
      - **Restricted media types**: uncheck **PDF and ZIP files delivery**
        (otherwise invoice/prescription share links return blank).
      - **Allowed delivery types**: keep `upload` + `authenticated`.
- [ ] Settings → Upload presets: leave default — folder pathing is set
      server-side per clinic.
- [ ] Add `CLOUDINARY_*` env vars to Vercel (Production scope).

## 6. Resend (email)

- [ ] Add the domain (Resend → Domains → Add). Apply the listed DNS records
      at your registrar:
      - `MX 10 feedback-smtp.eu-west-1.amazonses.com`
      - `TXT @ "v=spf1 include:amazonses.com ~all"`
      - `TXT resend._domainkey ...` (DKIM)
      - `TXT _dmarc "v=DMARC1; p=none;"` (start with `p=none`, ratchet to
        `quarantine` after a week of clean reports).
- [ ] Verify domain in Resend dashboard (yellow → green).
- [ ] Issue an API key restricted to **Sending access**. Save as
      `RESEND_API_KEY` in Vercel.
- [ ] Set `RESEND_FROM_EMAIL=noreply@your-domain.ma` and
      `RESEND_FROM_NAME=<Clinic Name>`.

## 7. Sentry

- [ ] Create a Next.js project at https://sentry.io.
- [ ] Copy the DSN → `NEXT_PUBLIC_SENTRY_DSN` (Production + Preview scopes).
- [ ] Generate a build-only auth token (Settings → Auth Tokens → Create →
      scopes `project:releases`, `org:read`) → `SENTRY_AUTH_TOKEN` in Vercel.
- [ ] Set `SENTRY_ORG` + `SENTRY_PROJECT` env vars (used to upload source
      maps on each build).
- [ ] Verify by visiting `/[locale]/throw-test` (only present in dev) once
      after deploy.

## 8. Upstash Redis

- [ ] Create a free-tier Redis DB at https://upstash.com. Region: `eu-west-1`.
- [ ] Copy the **REST URL** and **REST Token** (not the standard URL).
- [ ] Add `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` to Vercel.
- [ ] Verify by hammering `/forgot-password` 4 times in a row — the 4th
      should return the generic ok response while no email is sent.

## 9. WhatsApp Business Cloud API (when ready)

- [ ] Meta Business Manager → WhatsApp Business Platform → System User.
- [ ] Add the 4 templates from `docs/whatsapp-templates.md` and wait for
      approval (~24h).
- [ ] Add a verified phone number; copy `WHATSAPP_PHONE_ID` (not the phone
      number itself).
- [ ] Configure the webhook URL: `https://your-domain.ma/api/webhooks/whatsapp`.
- [ ] Add `WHATSAPP_*` env vars to Vercel. Without them the cron logs the
      messages it would send but doesn't bill Meta.

## 10. Cron jobs

The repo includes three cron endpoints (`appointment-reminders`,
`payment-plan-reminders`, `recall-reminders`). Schedule them in
`vercel.json` at the project root:

```json
{
  "crons": [
    { "path": "/api/cron/appointment-reminders",   "schedule": "0 18 * * *" },
    { "path": "/api/cron/payment-plan-reminders",  "schedule": "0 9 * * *" },
    { "path": "/api/cron/recall-reminders",        "schedule": "0 10 * * 1" }
  ]
}
```

- [ ] Generate a random `CRON_SECRET` (`openssl rand -hex 32`) and add to
      Vercel. The cron routes verify `Authorization: Bearer <secret>` and
      Vercel cron injects it automatically.

## 11. Final pre-launch

- [ ] Hit `https://your-domain.ma/api/health` — expect `200 { status: "ok" }`
      with every check `true`.
- [ ] Run a smoke test: login → create a patient → book an appointment →
      finalize an invoice → share via WhatsApp → verify the patient receives
      a clickable Cloudinary PDF URL.
- [ ] Trigger a deliberate error (e.g. `/throw-test` route in dev, or
      mistype a Server Action) and confirm it lands in Sentry within 30 s.
- [ ] Subscribe an uptime monitor (UptimeRobot, BetterStack) to
      `/api/health` with a 1-minute interval. Alert channels: email + WhatsApp.
- [ ] Snapshot the DB once manually (`pg_dump` via Neon console or CLI) and
      store it off-Neon (e.g. private S3 bucket) — see `backup-restore.md`.

## Every deploy

- [ ] `pnpm typecheck && pnpm lint && pnpm build` locally before merging.
- [ ] Vercel preview deploy reviewed before promoting to production.
- [ ] Sentry shows zero new error groups in the 30 minutes following deploy.
- [ ] `/api/health` returns 200 within 60 s of deploy completion.
- [ ] Rollback procedure: Vercel dashboard → Deployments → previous green
      build → Promote to Production. DB migrations are not automatically
      reverted — flag migrations as **breaking** in their commit message
      and prepare a `down` migration before merging.

---

## Owner sign-off

|                  | Name | Date |
|------------------|------|------|
| Domain + DNS     |      |      |
| Database backup  |      |      |
| Sentry verified  |      |      |
| Smoke test       |      |      |
