# TODO — DentalCare Management System (v1.1)

> Liste de tâches dérivée de [plan.md](./plan.md) v1.1. Voir le plan pour les critères d'acceptation détaillés.

## Légende
- `S` = Small (1-2 fichiers) · `M` = Medium (3-5 fichiers)
- 🆕 = ajouté en v1.1 (idées 2-5, 7-9 + odontogramme + trilingue + Prisma)

---

## ⚠ Bloquants à débloquer avant Phase 4

- [x] **Q7** — Templates WhatsApp rédigés dans [docs/whatsapp-templates.md](../docs/whatsapp-templates.md). **Reste à faire :** soumettre les 12 à Meta Business Manager (délai approbation 24-72h)
- [x] **Q8** — Identité visuelle (palette + logo SVG) dans [docs/brand/](../docs/brand/). **Reste à faire :** validation utilisateur (ou ajustement teinte/wordmark)

---

## Phase 0 — Foundation

- [x] **T0.1** — Init Next.js 16 + TS strict + Tailwind v4 + shadcn/ui + Prettier `S` ✅ 2026-05-13
- [x] **T0.2** — Connexion Neon + **Prisma 7** (adapter Neon + DIRECT_URL + page `/db-check`) `S` ✅ 2026-05-13
- [x] **T0.3** — **i18n next-intl trilingue FR/EN/AR (RTL)** + `formatCurrency` DH `M` ✅ 2026-05-13
- [x] **T0.4** — Scripts npm + structure `src/` + `env.ts` (Zod) + `Result<T,E>` `S` ✅ 2026-05-13
- [x] **Checkpoint Phase 0** — 3 locales OK, `/db-check` lit Neon, Prisma + i18n validés ✅

## Phase 1 — Auth, RBAC, Multi-tenant

- [x] **T1.1** — Schéma `Clinic` + `User` + `PasswordResetToken` + enum `UserRole` `S` ✅ 2026-05-14
- [x] **T1.2** — Auth.js v5 Credentials + page login trilingue + Argon2id `M` ✅ 2026-05-14
- [x] **T1.3** — Helpers RBAC + clinic-context + Prisma extension multi-tenant `M` ✅ 2026-05-14
- [x] **T1.4** — Proxy auth + rate limit login (5/15 min/IP) `S` ✅ 2026-05-14
- [x] **T1.5** — Reset password (token single-use 30 min + pages forgot/reset trilingues) `M` ✅ 2026-05-14
- [x] **T1.6** — Layout dashboard + sidebar (RBAC) + topbar (Cmd+K placeholder) + user menu `M` ✅ 2026-05-14
- [x] **T1.7** — Seed cabinet + admin + dentiste/réceptionniste `S` ✅ 2026-05-14
- [x] **Checkpoint Phase 1** — proxy/RBAC OK, 3 users seedés, API auth répond, reset password e2e wired ✅

## Phase 2 — Patients

- [x] **T2.1** — Schémas `Patient` + `PatientAllergy` + `AuditLog` + enums + index trigram GIN `S` ✅ 2026-05-14
- [x] **T2.2** — Server Actions CRUD + audit log + Zod téléphone E.164 marocain `M` ✅ 2026-05-14
- [x] **T2.3** — Page liste patients (FTS debounce, avatar coloré, badges État, filtres ville/statut, pagination numérotée) `M` ✅ 2026-05-15
- [x] **T2.4** — Formulaire create/edit (4 sections, allergies multi-tag, préférences, consentement) `M` ✅ 2026-05-14
- [x] **T2.5** — Page détail patient (header complet + 6 onglets + sidebar 3 sections + placeholders phases) `M` ✅ 2026-05-15
- [x] **Checkpoint Phase 2** — CRUD bout-en-bout testé en live, auth + multi-tenant scoping vérifiés ✅

## Phase 3 — Dentistes

- [x] **T3.1** — Schémas `Dentist` + `WorkingSchedule` + `DentistAbsence` + relation 1-1 User↔Dentist `S` ✅ 2026-05-14
- [x] **T3.2** — Server Actions CRUD + `setSchedule` (anti-chevauchement) + `addAbsence`/`removeAbsence` `S` ✅ 2026-05-14
- [x] **T3.3** — Page `/dentists` admin + modale create animée + détail 3 onglets + color picker `M` ✅ 2026-05-14
- [x] **Checkpoint Phase 3** — 2 dentistes seedés (Dr Karim + Dr Salma) · 14 plages · 1 absence ✅

## Phase 4 — Rendez-vous + WhatsApp + Liste d'attente

- [x] **T4.1** — Schéma `Appointment` + enum status + index conflit + token confirmation `S` ✅ 2026-05-15
- [x] **T4.2** — Server Actions RDV + détection chevauchement + horaires/absences + `confirmByToken` `M` ✅ 2026-05-15
- [x] **T4.3** — Calendrier vue semaine custom + dialog create/edit (intercepté) + autocomplete patient `M` ✅ 2026-05-15
- [x] **T4.4** — WhatsApp Cloud API sender + 4 templates typés (Q7 wired) `M` ✅ 2026-05-15
- [x] **T4.5** — Webhook WhatsApp (signature HMAC + boutons confirm/reschedule) + page `/confirm-appointment` `M` ✅ 2026-05-15
- [x] **T4.6** — Cron `/api/cron/appointment-reminders` + `vercel.json` (18:00 quotidien) `S` ✅ 2026-05-15
- [x] **T4.7** — Schéma `WaitlistEntry` + Server Actions (list / add / remove / findCandidates) `S` ✅ 2026-05-15
- [x] **T4.8** — Auto-matching sur annulation + advisory lock Postgres + WhatsApp template `M` ✅ 2026-05-15
- [x] **T4.9** — UI `/waitlist` + modale add + page publique `waitlist-respond?token` `M` ✅ 2026-05-15
- [x] **Checkpoint Phase 4** — Code + tests structurels OK ; reste manuel : soumettre templates Meta + tester en navigateur ✅

## Phase 5 — Dossier médical + radios + photos avant/après

- [x] **T5.1** — Schémas `MedicalRecord` + `Radiograph` + **`TreatmentPhoto`** `S` 🆕 ✅
- [x] **T5.2** — Intégration Cloudinary (signature serveur) `M` ✅
- [x] **T5.3** — Server Actions dossier médical `S` ✅
- [x] **T5.4** — Onglet "Dossier médical" : timeline + upload radios + lightbox `M` ✅
- [x] **T5.5** — **Photos avant/après par traitement (avec consentement)** `M` 🆕 ✅
- [x] **Checkpoint Phase 5** — patient test avec radios + 1 paire avant/après ✅

## Phase 6 — Traitements

- [x] **T6.1** — Schémas catalogue + application + seed 9 traitements `S` ✅ 2026-05-15
- [x] **T6.2** — Admin catalogue traitements `S` ✅ 2026-05-15
- [x] **T6.3** — Section "Traitements" dans consultation (FDI dent + surfaces + prix) `M` ✅ 2026-05-15
- [x] **Checkpoint Phase 6** — données prêtes pour odontogramme + facturation ✅

## Phase 7 — Odontogramme graphique

- [x] **T7.1** — **Schéma `DentalChartEntry`** `S` 🆕 ✅ 2026-05-16
- [x] **T7.2** — **Composant SVG odontogramme (32 dents FDI, click, surfaces, couleurs)** `M` 🆕 ✅ 2026-05-16
- [x] **T7.3** — **Server Actions + `generatePlanFromChart` + onglet patient** `M` 🆕 ✅ 2026-05-16
- [x] **Checkpoint Phase 7** — odontogramme rempli sur patient test, revue UX ✅

## Phase 8 — Prescriptions

- [x] **T8.1** — Schéma `Prescription` + items `S` ✅ 2026-05-16
- [x] **T8.2** — Form prescription `S` ✅ 2026-05-16
- [x] **T8.3** — Page imprimable bilingue (locale figée à l'émission) + bouton partage WhatsApp `M` ✅ 2026-05-16

## Phase 9 — Facturation + Plan paiement échelonné

- [x] **T9.1** — Schémas + **fonction Postgres `next_invoice_number` (point départ aléatoire)** `S` 🆕 ✅ 2026-05-16
- [x] **T9.2** — Server Actions facturation + tests numérotation `M` ✅ 2026-05-16
- [x] **T9.3** — UI facturation (liste + édition + onglet patient) `M` ✅ 2026-05-16
- [x] **T9.4** — Page imprimable facture bilingue `S` ✅ 2026-05-16
- [x] **T9.5** — **Schémas `PaymentPlan` + `PaymentPlanInstallment`** `S` 🆕 ✅ 2026-05-16
- [x] **T9.6** — **Server Actions plans + cron relances WhatsApp (J-3, J+1)** `M` 🆕 ✅ 2026-05-16
- [x] **T9.7** — **UI plan de paiement (assistant création + échéancier visuel)** `M` 🆕 ✅ 2026-05-16
- [x] **Checkpoint Phase 9** — Code livré, tests Playwright restent à écrire en Phase 13

## Phase 10 — Stock

- [x] **T10.1** — Schémas `StockItem` + `StockMovement` `S` ✅ 2026-05-16
- [x] **T10.2** — Server Actions stock + mouvements atomiques `S` ✅ 2026-05-16
- [x] **T10.3** — UI stock + badges seuil/expiration + modal mouvement `M` ✅ 2026-05-16
- [x] **Checkpoint Phase 10** — 5 articles seedés ✅

## Phase 11 — Recall + Recherche globale Cmd+K

- [x] **T11.1** — **Schéma `RecallReminder` + génération auto après consultation** `S` 🆕 ✅ 2026-05-16
- [x] **T11.2** — **Server Actions recalls + cron quotidien 09:30 WhatsApp** `M` 🆕 ✅ 2026-05-16
- [x] **T11.3** — **UI page `/recalls`** `S` 🆕 ✅ 2026-05-16
- [x] **T11.4** — **Cmd+K Command Palette + globalSearch (patients/RDV/factures/stock)** `M` 🆕 ✅ 2026-05-16
- [x] **Checkpoint Phase 11** — code livré, perf à mesurer en prod ✅

## Phase 12 — Dashboard

- [x] **T12.1** — Server functions KPIs (admin/dentiste/réceptionniste) + cache 60s `M` ✅ 2026-05-16
- [x] **T12.2** — UI dashboard par rôle + Recharts `M` ✅ 2026-05-16
- [x] **Checkpoint Phase 12** — KPIs + 3 charts (revenue 6w, upcoming 7d, donut traitements) + alertes stock + rappels ✅

## Phase 13 — i18n finalisation, audit, polish, deploy

- [ ] **T13.1** — Compléter traductions FR/EN/AR + audit RTL toutes pages `M`
- [ ] **T13.2** — Audit log appliqué + page `/settings/audit-log` admin `S`
- [ ] **T13.3** — Polish global (skeletons, empty states, toasts sonner, 404/500) `S`
- [ ] **T13.4** — 5 tests E2E Playwright en CI `M`
- [ ] **T13.5** — Déploiement Vercel + Neon prod (env vars + migration postinstall + smoke) `S`
- [ ] **T13.6** — README + runbook + `docs/whatsapp-templates.md` + `.env.example` `S`
- [ ] **Checkpoint final** — 5 E2E verts, smoke prod, démo seedée complète, revue V1

---

## Questions à trancher

- [ ] **Q1** — Backup radios hors Cloudinary ? (avant fin Phase 5)
- [ ] **Q2** — Upload signature dentiste (PNG, dans profil) ? (avant Phase 8)
- [ ] **Q5** — Durée légale archivage dossier médical Maroc (avant prod)
- [ ] **Q6** — Stock par lots ou quantité globale ? (avant Phase 10)
- [x] **Q7** — Templates WhatsApp rédigés ([docs/whatsapp-templates.md](../docs/whatsapp-templates.md)) — reste soumission Meta
- [x] **Q8** — Identité visuelle proposée ([docs/brand/](../docs/brand/)) — reste validation

## Hors V1 (cf. SPEC §11)

- Portail patient (réservation en ligne)
- Application mobile native
- 2FA (idée #6 écartée)
- Devis avant traitement (idée #1 écartée)
- Multi-cabinet **opérationnel** (architecture préparée seulement)
- Intégration assurance/CNOPS/CNSS
- Téléconsultation
- Export comptable détaillé
- Dents de lait (FDI 51-85) dans odontogramme
