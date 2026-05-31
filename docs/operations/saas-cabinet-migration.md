# Migration plan — DentalCare → saas cabinet architecture

> Status: 📝 Backlog — to schedule once the current V1 has paying customers.
> Source design: `c:\Users\Mehdi\Desktop\saas cabinet\` (SPEC.md, PLAN.md, CLAUDE.md).

## Why migrate

The `saas cabinet` blueprint is a more scalable, multi-vertical refresh of
this codebase. The big wins it brings:

- **Zero cron jobs** — event-driven via `EventOutbox` + n8n workflows.
  Replaces our 3 Vercel crons (`appointment-reminders`,
  `payment-plan-reminders`, `recall-reminders`) with retryable workflows
  that have visual debug + auto-retry on failure.
- **AI chatbot WhatsApp/Telegram** — patients book/move/cancel RDV in
  natural language. Cascade Gemini 2.0 Flash (free 1500/day) → Groq Llama
  3.3 70B fallback. Never paid Claude.
- **Multi-vertical from day 1** — one codebase, 6 verticals (dental,
  general practice, kinesiology, osteopathy, psychology, midwifery). One
  `vertical_template` row in DB drives accent color, sample acts, etc.
- **Type safety end-to-end** — tRPC v11 instead of plain Server Actions.
  Mobile (Expo) consumes the same router types.

## What stays the same

- Tailwind + shadcn/ui
- Liquid Glass design system (already applied)
- Cloudinary for images
- Stripe for billing (we don't have it yet — would add during migration)

## What changes

| Layer | Today | After |
|---|---|---|
| Monorepo | Single Next.js app | Turborepo + pnpm workspaces |
| API | Server Actions | tRPC v11 + zod |
| Auth | Auth.js v5 | Better-Auth + `organization` plugin |
| DB | Neon Postgres + Prisma 7 | Supabase Postgres + Prisma 6 |
| Cron | 3 Vercel crons | n8n self-hosted on a VPS |
| AI | None | Cascade Gemini Flash → Groq via `AICascadeProvider` |
| Mobile | PWA only | React Native Expo (shared tRPC client) |
| Verticals | Dental only | 6 verticals via `data-vertical` attr |
| i18n | fr/en/ar | fr/en only (Maghreb decision) |
| Crons removed | — | All replaced by `publishEvent()` → n8n flows |

## High-level migration sprints

| Sprint | Scope | Weeks |
|---|---|---|
| M0 | Bootstrap monorepo, copy code, set up shared packages | 1 |
| M1 | Migrate auth to Better-Auth + multi-tenant `organization` | 1 |
| M2 | Server Actions → tRPC v11 routers (patients, appointments, invoices) | 2 |
| M3 | Outbox + n8n setup, replace J-1 reminder cron with first n8n workflow | 1 |
| M4 | AI chatbot WhatsApp — `AICascadeProvider` + function calling | 2 |
| M5 | Replace remaining crons (payment-plan, recall) with n8n | 1 |
| M6 | Mobile app skeleton (Expo) reading same tRPC routers | 2 |
| M7 | Vertical templating (add kinesiology as second vertical) | 1 |
| M8 | Cleanup + production cutover (DNS, smoke tests, rollback drill) | 1 |

**Total**: ~12 weeks of focused work. NOT urgent — V1 SaaS can sell to
dental cabinets without any of this. The migration is the **scale-up
play** once we have ~10+ paying cabinets and a clear demand signal for
multi-vertical or AI booking.

## Triggers that should start the migration

Migrate when at least **two** of these become true:

1. We have ≥ 10 paying cabinets — revenue justifies the engineering cost.
2. A prospect explicitly asks for AI WhatsApp booking (and is willing to
   pay more for it).
3. We have a non-dental vertical lead (kine, ostéo, psy) that we want to
   sell to. Today's single-vertical codebase would need an awkward rewrite.
4. Our Vercel cron flakiness becomes a support issue (J-1 reminders missed
   due to function timeout, etc.).
5. We hire a second engineer who can take ownership of the migration.

Until then: **iterate on V1**. The Liquid Glass design system, the recall
auto-generation, the WhatsApp PDF share, the GDPR export — all of that is
already a sellable product.
