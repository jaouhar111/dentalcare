# Plan d'implémentation — DentalCare Management System

> Version 1.1 — Plan dérivé de [SPEC.md](../SPEC.md) v1.1. Découpage **vertical** : chaque tâche livre une fonctionnalité de bout en bout (DB → Server Action → UI).

## Vue d'ensemble

**13 phases, ~55 tâches** calibrées **S** (1-2 fichiers) ou **M** (3-5 fichiers).

Le périmètre intègre les **idées 2-5, 7-9** retenues par l'utilisateur :
- Multi-tenant préparé (#5) — cross-cutting dès Phase 1
- Liste d'attente RDV (#2) — Phase 4
- Confirmation WhatsApp 1-clic (#4) — Phase 4
- Photos avant/après (#8) — Phase 5
- Odontogramme graphique (demandé) — Phase 7
- Plan de paiement échelonné (#7) — Phase 9
- Rappels de contrôle / recall (#3) — Phase 11
- Recherche globale Cmd+K (#9) — Phase 11
- Trilingue FR/EN/AR (RTL) dès V1 — Phase 0 + Phase 13

## Décisions d'architecture clés

- **Prisma** (schéma déclaratif) + **Neon** pooled (`DATABASE_URL` + `DIRECT_URL` migrations)
- **Server Actions** pour toutes les mutations
- **Multi-tenant** : `clinicId` sur toutes les tables métier, middleware Prisma d'injection automatique, helper `getClinicContext()`
- **next-intl** trilingue dès la Phase 0 (pas d'ajout tardif)
- **Auth.js v5** Credentials + JWT + Argon2id, **sans 2FA** en V1
- **WhatsApp Cloud API (Meta)** : 4 templates pré-approuvés à valider avant Phase 4
- **Zod** + **React Hook Form**
- **RBAC** : helper `requireRole` + middleware route
- **Tests** : Vitest unitaires + Playwright 5 parcours E2E

## Graphe de dépendances

```
Phase 0 (Foundation: Next + Prisma + i18n trilingue)
        │
        ▼
Phase 1 (Auth + RBAC + Multi-tenant + Clinics)
        │
        ├─────────────────────────┐
        ▼                         ▼
Phase 2 (Patients)         Phase 3 (Dentistes + horaires)
        │                         │
        └────────────┬────────────┘
                     ▼
            Phase 4 (RDV + WhatsApp + Liste d'attente)
                     │
                     ▼
            Phase 5 (Dossier médical + radios + photos avant/après)
                     │
                     ▼
            Phase 6 (Traitements: catalogue + application)
                     │
                     ▼
            Phase 7 (Odontogramme graphique)
                     │
                     ▼
            Phase 8 (Prescriptions PDF)
                     │
                     ▼
            Phase 9 (Facturation + Plan paiement échelonné)
                     │
                     ▼
            Phase 10 (Stock) — peut être parallélisé après Phase 1
                     │
                     ▼
            Phase 11 (Recall + Recherche Cmd+K)
                     │
                     ▼
            Phase 12 (Dashboard)
                     │
                     ▼
            Phase 13 (Notifications + polish + i18n finalisation + deploy)
```

---

# Phase 0 — Foundation

> Objectif : Next.js + Prisma + Neon + shadcn + i18n trilingue installés et chaînés.

## T0.1 — Initialiser Next.js 15 + TS + Tailwind + shadcn/ui (S)

**AC :**
- [ ] Projet Next.js 15 (App Router, TS strict, pnpm)
- [ ] Tailwind configuré, shadcn/ui initialisé
- [ ] 3 composants shadcn de base installés (button, input, card)
- [ ] ESLint + Prettier + plugin tailwind
- [ ] `tsconfig.json` strict + paths `@/*`

**Verification :** `pnpm dev` OK, `pnpm build` OK, page d'accueil affiche un Button shadcn.
**Dependencies :** —
**Taille :** S

## T0.2 — Connexion Neon + Prisma (S)

**AC :**
- [ ] `prisma`, `@prisma/client` installés
- [ ] `prisma/schema.prisma` initial avec datasource Neon (env `DATABASE_URL` + `DIRECT_URL`)
- [ ] Premier modèle `Meta` (clé/valeur) pour valider le pipeline
- [ ] `src/lib/db/client.ts` exporte un singleton PrismaClient
- [ ] `.env.example` documente DATABASE_URL + DIRECT_URL

**Verification :**
- [ ] `pnpm prisma migrate dev --name init` réussit sur branche Neon `dev`
- [ ] Page test `/db-check` lit une valeur depuis `Meta`

**Dependencies :** T0.1
**Taille :** S

## T0.3 — Setup i18n next-intl trilingue (M)

**AC :**
- [ ] `next-intl` installé et configuré
- [ ] Routing localisé `app/[locale]/…`
- [ ] Locales `fr` (défaut), `en`, `ar` ; cookie de persistance
- [ ] Middleware next-intl
- [ ] `messages/fr.json`, `messages/en.json`, `messages/ar.json` (squelettes)
- [ ] Composant `LocaleSwitcher` dans topbar (placeholder)
- [ ] `<html dir="rtl">` automatique en AR
- [ ] Helpers `formatCurrency()` (DH/MAD), `formatDate()` selon locale

**Verification :**
- [ ] `/fr`, `/en`, `/ar` affichent une page d'accueil traduite
- [ ] Bascule en AR → `dir="rtl"` appliqué
- [ ] `formatCurrency(1500)` rend `1 500,00 DH` en FR, `MAD 1,500.00` en EN

**Dependencies :** T0.1
**Taille :** M

## T0.4 — Scripts utilitaires + structure dossiers (S)

**AC :**
- [ ] Scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `db:migrate`, `db:studio`, `db:seed`, `db:reset`
- [ ] Structure `src/` conforme SPEC §5.4
- [ ] `src/lib/utils/result.ts` (`Result<T, E>`)
- [ ] `src/lib/env.ts` (validation Zod env)

**Dependencies :** T0.2
**Taille :** S

## Checkpoint Phase 0

- [ ] Build / typecheck / lint clean
- [ ] `/db-check` lit Neon
- [ ] Les 3 locales fonctionnent
- [ ] **Revue humaine** : valider choix Prisma + structure i18n

---

# Phase 1 — Auth, RBAC, Multi-tenant base

## T1.1 — Schéma `Clinic` + `User` + `PasswordResetToken` (S)

**AC :**
- [ ] Modèles Prisma : `Clinic` (avec `invoiceStartingNumber`), `User` (avec `clinicId`, `role`), `PasswordResetToken`
- [ ] `User.email` UNIQUE global
- [ ] Migration appliquée

**Dependencies :** T0.4
**Taille :** S

## T1.2 — Auth.js v5 + Credentials + page login trilingue (M)

**AC :**
- [ ] `auth.ts`, `auth.config.ts` (Auth.js v5)
- [ ] Provider Credentials + Argon2id
- [ ] Session JWT 7j
- [ ] Page `/[locale]/login` (RHF + Zod, libellés i18n)
- [ ] Logout

**Verification :** Login + logout OK ; mauvais mot de passe localisé.
**Dependencies :** T1.1, T0.3
**Taille :** M

## T1.3 — Multi-tenant context + Prisma middleware (M) *(idée #5)*

**AC :**
- [ ] Helper `getClinicContext()` (lit `clinicId` depuis session)
- [ ] Prisma middleware automatique : injecte `where: { clinicId }` sur les modèles tagués `@@map` multi-tenant
- [ ] Wrapper `prismaWithClinic(clinicId)` pour les Server Actions
- [ ] Tests Vitest : middleware filtre correctement, une requête sans context throw
- [ ] Documentation interne : liste des modèles multi-tenant vs globaux

**Verification :** créer 2 cabinets seedés, créer 2 users (un par cabinet), vérifier qu'un user A ne voit pas les données du cabinet B (test Vitest).
**Dependencies :** T1.2
**Taille :** M

## T1.4 — Middleware RBAC + redirections + rate limit login (S)

**AC :**
- [ ] `middleware.ts` redirige vers `/[locale]/login` si non auth
- [ ] Helper `requireRole(['admin','dentist','receptionist'])`
- [ ] Rate limit login : 5/15min/IP (in-memory)

**Dependencies :** T1.2
**Taille :** S

## T1.5 — Reset password (email Resend) (M)

**AC :**
- [ ] Page `/forgot-password` (trilingue)
- [ ] Page `/reset-password?token=…`
- [ ] Email Resend en 3 langues
- [ ] Token hashé, single-use, 30 min

**Dependencies :** T1.2
**Taille :** M

## T1.6 — Layout dashboard + sidebar + topbar + Cmd+K placeholder (M)

**AC :**
- [ ] `app/[locale]/(dashboard)/layout.tsx`
- [ ] Sidebar avec items conditionnés au rôle (i18n)
- [ ] Topbar : recherche placeholder, language switcher, profil
- [ ] Cmd+K bind global (mais palette vide pour l'instant)
- [ ] Responsive < 1024px
- [ ] Audit RTL : utilise `ms-*` / `me-*`

**Verification :** bascule fr→ar inverse le layout proprement.
**Dependencies :** T1.4, T1.3
**Taille :** M

## T1.7 — Seed cabinet + admin + script `db:seed` (S)

**AC :**
- [ ] Script `prisma/seed.ts` crée :
  - 1 cabinet (nom, adresse, `invoiceStartingNumber = crypto.randomInt(1000, 9999)`)
  - 1 admin (email/password depuis env)
  - 1 dentiste test, 1 réceptionniste test
- [ ] Idempotent

**Dependencies :** T1.3
**Taille :** S

## Checkpoint Phase 1

- [ ] 3 rôles peuvent se connecter
- [ ] Test Vitest multi-tenant isolation : vert
- [ ] Test Playwright #1 : login + bascule de locale — vert
- [ ] **Revue humaine** : valider Prisma middleware + navigation par rôle

---

# Phase 2 — Patients

## T2.1 — Schéma `Patient` + `PatientAllergy` + index FTS (S)

**AC :**
- [ ] Modèles Prisma + `clinicId`
- [ ] Soft delete `deletedAt`
- [ ] Champs `preferredChannel`, `preferredLocale`, `photoConsent`
- [ ] Migration custom SQL : `CREATE EXTENSION pg_trgm`, GIN trigram sur (`firstName`, `lastName`, `cin`, `phone`)
- [ ] UNIQUE partial sur `(clinicId, cin)`

**Dependencies :** T1.7
**Taille :** S

## T2.2 — Server Actions CRUD patients + audit log (M)

**AC :**
- [ ] `createPatient`, `updatePatient`, `softDeletePatient`, `getPatient`, `listPatients(query, page)`
- [ ] Zod normalise téléphone E.164 marocain
- [ ] RBAC : suppression admin only
- [ ] Modèle `AuditLog` + helper `audit(action, entity, payload)` créé ici
- [ ] Tests Vitest : zod schema, recherche

**Dependencies :** T2.1
**Taille :** M

## T2.3 — Page liste patients (M)

**AC :**
- [ ] `/[locale]/patients` : table shadcn (nom, téléphone, dernière visite)
- [ ] Recherche debounce 300 ms
- [ ] Pagination 50/page
- [ ] Empty state i18n
- [ ] Bouton "Nouveau patient"

**Dependencies :** T2.2
**Taille :** M

## T2.4 — Formulaire création/édition + consentement photos + préférences (M)

**AC :**
- [ ] RHF + Zod
- [ ] Multi-tag allergies, datepicker
- [ ] Section préférences : canal de contact + langue
- [ ] Section consentement photos avant/après (checkbox + date auto)
- [ ] Erreurs serveur i18n

**Dependencies :** T2.3
**Taille :** M

## T2.5 — Page détail patient avec onglets (M)

**AC :**
- [ ] `/patients/[id]` : header + onglets `Infos`, `Dossier`, `Odontogramme`, `RDV`, `Factures` (placeholders)
- [ ] Boutons Modifier / Supprimer (RBAC)

**Dependencies :** T2.4
**Taille :** M

## Checkpoint Phase 2

- [ ] CRUD patient end-to-end + bascule de locale persiste préférence patient
- [ ] Test Playwright #2 : créer patient + retrouver via recherche — vert

---

# Phase 3 — Dentistes et horaires

## T3.1 — Schéma `Dentist` + `WorkingSchedule` + `DentistAbsence` (S)

**Dependencies :** T1.7
**Taille :** S

## T3.2 — Server Actions dentistes (S)

**AC :** CRUD + `setSchedule` + `addAbsence` + `removeAbsence`.
**Dependencies :** T3.1
**Taille :** S

## T3.3 — Page admin dentistes + UI horaires + couleur (M)

**AC :**
- [ ] `/dentists` (admin)
- [ ] Editor hebdo (7 jours, multi-plages)
- [ ] Absences (date range + raison)
- [ ] Color picker shadcn

**Dependencies :** T3.2
**Taille :** M

## Checkpoint Phase 3

- [ ] 2 dentistes seedés avec horaires + 1 absence

---

# Phase 4 — Rendez-vous + WhatsApp + Liste d'attente

> **Pré-requis externes** : Compte Meta Business + numéro WhatsApp vérifié + 4 templates pré-approuvés (cf. Q7).

## T4.1 — Schéma `Appointment` + index conflit (S)

**AC :**
- [ ] Modèle Prisma avec enum statut
- [ ] Champs `reminderSentAt`, `confirmationReceivedAt`, `confirmationToken` UNIQUE
- [ ] Index `(dentistId, startAt)`

**Dependencies :** T2.1, T3.1
**Taille :** S

## T4.2 — Server Actions RDV + détection conflits (M)

**AC :**
- [ ] `createAppointment` rejette chevauchement (transaction + advisory lock) et hors horaire/absence
- [ ] `updateAppointment`, `cancelAppointment(reason)`, `markStatus`
- [ ] `confirmByToken(token)` (utilisé par le lien email/WhatsApp button)
- [ ] `requestReschedule(token)` crée une tâche à traiter par réceptionniste

**Dependencies :** T4.1
**Taille :** M

## T4.3 — Page calendrier FullCalendar + dialog création/édition (M)

**AC :**
- [ ] FullCalendar (jour/semaine/mois, RTL support)
- [ ] Filtre dentiste, couleurs
- [ ] Drag & drop avec rollback en cas de conflit
- [ ] Dialog création : patient autocomplete, dentiste, durée 15/30/45/60, motif

**Dependencies :** T4.2
**Taille :** M

## T4.4 — Intégration WhatsApp Cloud API (sender + templates) (M) *(idée #4)*

**AC :**
- [ ] `src/lib/whatsapp/client.ts` (envoi message template)
- [ ] 4 templates configurés (config JSON ou DB) : `appointment_reminder`, `waitlist_slot_offered`, `checkup_reminder`, `payment_due`
- [ ] `sendTemplate({ to, templateName, locale, params })` typé
- [ ] Sélection auto langue selon `Patient.preferredLocale`
- [ ] Mock en mode dev (log console) si pas de credentials

**Verification :** envoi manuel d'un template `appointment_reminder` vers numéro test → reçu.
**Dependencies :** T0.4
**Taille :** M

## T4.5 — Webhook WhatsApp + confirmation 1-clic (M)

**AC :**
- [ ] Route Handler `/api/webhooks/whatsapp` vérifie signature HMAC Meta
- [ ] Parse callback boutons `Confirmer` / `Reporter`
- [ ] Met à jour `confirmationReceivedAt` ou crée tâche replanification
- [ ] Page email fallback `/confirm-appointment?token=…` (pour patients sans WhatsApp)
- [ ] Tests Vitest : signature webhook, transition statut

**Dependencies :** T4.2, T4.4
**Taille :** M

## T4.6 — Cron rappels J-1 (S)

**AC :**
- [ ] Route `/api/cron/appointment-reminders` (protégée par `CRON_SECRET`)
- [ ] Envoie WhatsApp ou email selon `preferredChannel`
- [ ] Flag `reminderSentAt` pour éviter doublon
- [ ] `vercel.json` cron quotidien 18:00

**Dependencies :** T4.4, T4.5
**Taille :** S

## T4.7 — Schéma `WaitlistEntry` + Server Actions (S) *(idée #2)*

**AC :**
- [ ] Modèle Prisma + `clinicId`, dentiste optionnel, durée, plage horaire idéale, statut, expiration
- [ ] `addToWaitlist`, `removeFromWaitlist`, `listWaitlist`
- [ ] `findCandidatesForSlot(start, end, dentistId)` : matching SQL ordonné par ancienneté

**Dependencies :** T4.1
**Taille :** S

## T4.8 — Auto-matching liste d'attente sur annulation + proposition WhatsApp (M) *(idée #2)*

**AC :**
- [ ] Hook après `cancelAppointment` : appelle `findCandidatesForSlot`
- [ ] Pour chaque candidat (max 5 simultanés) : envoi WhatsApp `waitlist_slot_offered`
- [ ] Lien dans le message → `/[locale]/waitlist/accept?token=…`
- [ ] Server Action `acceptProposal(token)` avec verrou advisory : premier qui clique gagne
- [ ] Délai 15 min, sinon expiration auto et passage au candidat suivant

**Verification :** scénario test : 3 patients en liste d'attente → annulation → tous reçoivent → premier accepte → RDV créé + autres notifiés "déjà attribué".
**Dependencies :** T4.7, T4.4
**Taille :** M

## T4.9 — UI Liste d'attente (M) *(idée #2)*

**AC :**
- [ ] `/waitlist` : liste filtrable (dentiste, statut, ancienneté)
- [ ] Bouton "Ajouter à la liste" depuis fiche patient ou directement
- [ ] Statut visuel par badge

**Dependencies :** T4.7
**Taille :** M

## Checkpoint Phase 4

- [ ] Test Playwright #3 : "créer RDV + confirmer via lien email" — vert
- [ ] Test Vitest : auto-matching liste d'attente — vert
- [ ] Templates WhatsApp testés en envoi réel
- [ ] **Revue humaine** : ergonomie calendrier + scénario annulation/liste d'attente complet

---

# Phase 5 — Dossier médical, radios, photos avant/après

## T5.1 — Schémas `MedicalRecord` + `Radiograph` + `TreatmentPhoto` (S)

**Dependencies :** T2.1, T3.1, T4.1
**Taille :** S

## T5.2 — Intégration Cloudinary (signature serveur + suppression) (M)

**AC :**
- [ ] `src/lib/cloudinary/client.ts` (admin SDK)
- [ ] Server Action `getUploadSignature(folder, resourceType)` (restreinte par patient + clinic)
- [ ] Composant client upload avec preview
- [ ] URL signée 1h pour affichage

**Dependencies :** T0.4
**Taille :** M

## T5.3 — Server Actions dossier médical + radios (S)

**Dependencies :** T5.1, T5.2
**Taille :** S

## T5.4 — Onglet "Dossier médical" sur fiche patient (M)

**AC :**
- [ ] Timeline consultations
- [ ] Création/édition consultation
- [ ] Upload radios drag & drop
- [ ] Galerie + lightbox

**Dependencies :** T5.3
**Taille :** M

## T5.5 — Photos avant/après par traitement (M) *(idée #8)*

**AC :**
- [ ] Upload uniquement si `patient.photoConsent = true` (sinon UI bloque + lien vers consentement)
- [ ] Métadonnée : type (before/after), traitement référencé, caption
- [ ] Vue comparée avant/après côte-à-côte (avec slider optionnel)
- [ ] Suppression côté Cloudinary + DB

**Verification :** upload 1 before + 1 after sur un traitement → vue comparée fonctionne.
**Dependencies :** T5.4, T6.3 (référence traitement appliqué — accepter dépendance lâche pour cette tâche, ou réordonner si besoin)
**Taille :** M

## Checkpoint Phase 5

- [ ] 1 patient avec 2 consultations, 4 radios, 1 paire avant/après
- [ ] Vérifier crédits Cloudinary

---

# Phase 6 — Traitements

## T6.1 — Schéma `TreatmentCatalog` + `TreatmentApplication` + seed 9 traitements V1 (S)

**Dependencies :** T5.1
**Taille :** S

## T6.2 — Admin catalogue traitements (S)

**AC :** `/settings/treatments` CRUD + activation.
**Dependencies :** T6.1
**Taille :** S

## T6.3 — Appliquer traitement à une consultation (M)

**AC :**
- [ ] Section "Traitements" dans fiche consultation
- [ ] Ajout : catalogue + dent FDI + surfaces + prix + statut + remise
- [ ] Récap total

**Dependencies :** T6.2, T5.4
**Taille :** M

## Checkpoint Phase 6

- [ ] Données prêtes pour Phase 7 (odontogramme) et Phase 9 (facturation)

---

# Phase 7 — Odontogramme graphique

## T7.1 — Schéma `DentalChartEntry` (S)

**AC :**
- [ ] Modèle Prisma + index `(patientId, toothNumber)` + `(patientId, recordedAt)`
- [ ] Enum `condition`

**Dependencies :** T6.1
**Taille :** S

## T7.2 — Composant SVG odontogramme (M)

**AC :**
- [ ] Composant `<Odontogram patientId mode="read"|"edit" />`
- [ ] SVG des 32 dents permanentes (FDI 11-48)
- [ ] Click → panneau latéral détail dent
- [ ] Code couleur selon dernière condition
- [ ] Mode édition : ajouter/modifier/supprimer condition (réservé dentiste/admin)
- [ ] Surfaces (mésiale, distale, etc.) en sous-vue dent
- [ ] Mémoïsation perfs
- [ ] Audit RTL (le SVG est miroir-safe, vérifier ordre dents en AR)

**Dependencies :** T7.1
**Taille :** M

## T7.3 — Server Actions odontogramme + intégration fiche patient (M)

**AC :**
- [ ] `getPatientChart(patientId)` : dernière condition par dent
- [ ] `addEntry`, `updateEntry`, `removeEntry`
- [ ] `generatePlanFromChart(patientId, dentNumbers[])` : crée des traitements planifiés à partir d'une sélection de dents marquées
- [ ] Onglet "Odontogramme" sur fiche patient utilise le composant
- [ ] Historique par dent visible

**Verification :** marquer 3 dents → générer plan → traitements créés dans dernière consultation ouverte.
**Dependencies :** T7.2, T6.3
**Taille :** M

## Checkpoint Phase 7

- [ ] Odontogramme fonctionnel sur un patient test (5 conditions diverses)
- [ ] **Revue humaine** : valider UX odontogramme (cœur produit différenciant)

---

# Phase 8 — Prescriptions

## T8.1 — Schéma `Prescription` + items (S)

**Dependencies :** T5.1
**Taille :** S

## T8.2 — Form prescription dans consultation (S)

**Dependencies :** T8.1
**Taille :** S

## T8.3 — Génération PDF ordonnance bilingue (M)

**AC :**
- [ ] `@react-pdf/renderer` configuré côté serveur
- [ ] Template bilingue (langue patient + arabe par défaut)
- [ ] Server Action `generatePdf(prescriptionId)`
- [ ] Envoi par email (Resend) et WhatsApp (document)

**Dependencies :** T8.2
**Taille :** M

---

# Phase 9 — Facturation + Plan de paiement échelonné

## T9.1 — Schémas `Invoice` + `InvoiceLine` + `Payment` + numérotation (S)

**AC :**
- [ ] Tables Prisma + UNIQUE `(clinicId, number)`
- [ ] Fonction Postgres `next_invoice_number(clinicId)` qui lit `Clinic.invoiceStartingNumber` + compte les factures + formate `F-YYYY-NNNN`
- [ ] Migration custom SQL pour cette fonction

**Dependencies :** T6.1
**Taille :** S

## T9.2 — Server Actions facturation (M)

**AC :**
- [ ] `createInvoice`, `createFromMedicalRecord(recordId)` (reprend traitements terminés)
- [ ] `emitInvoice` (irréversible, fige le numéro via la fonction)
- [ ] `addLine`, `removeLine`, `recordPayment`, `voidInvoice`
- [ ] Calcul auto totaux + transitions statut
- [ ] Tests Vitest : numérotation (séquentielle après le point de départ), calculs

**Dependencies :** T9.1
**Taille :** M

## T9.3 — UI facturation (M)

**AC :**
- [ ] `/invoices` (liste + filtres)
- [ ] `/invoices/[id]` (édition lignes, paiements, historique)
- [ ] Onglet "Factures" patient

**Dependencies :** T9.2
**Taille :** M

## T9.4 — PDF facture bilingue (S)

**AC :** template bilingue + bouton téléchargement.
**Dependencies :** T9.3
**Taille :** S

## T9.5 — Schéma `PaymentPlan` + `PaymentPlanInstallment` (S) *(idée #7)*

**Dependencies :** T9.1
**Taille :** S

## T9.6 — Server Actions plans de paiement + relances (M) *(idée #7)*

**AC :**
- [ ] `createPaymentPlan(invoiceId, installmentsCount, startDate, downPayment?)`
- [ ] Génère les échéances avec dates
- [ ] `recordInstallmentPayment(installmentId, paymentPayload)` lie paiement et marque statut
- [ ] `cancelPaymentPlan`, `listOverdueInstallments`
- [ ] Cron `/api/cron/payment-plan-reminders` : WhatsApp J-3 et J+1 si non payé
- [ ] `vercel.json` cron quotidien 09:00
- [ ] Tests Vitest : génération échéances, transitions

**Dependencies :** T9.5, T4.4
**Taille :** M

## T9.7 — UI plan de paiement (M) *(idée #7)*

**AC :**
- [ ] `/payment-plans` : liste avec statuts
- [ ] Bouton "Créer plan" depuis facture → assistant (nb échéances, périodicité)
- [ ] Échéancier visuel avec restant dû
- [ ] Vue patient : onglet Factures montre les plans actifs

**Dependencies :** T9.6
**Taille :** M

## Checkpoint Phase 9

- [ ] Test Playwright #4 : "consultation → facture émise → paiement" — vert
- [ ] Test Playwright #5 : "facture → créer plan 6 mensualités → payer 2 échéances" — vert
- [ ] **Revue humaine** : PDF facture (mentions légales Maroc + bilingue)

---

# Phase 10 — Stock

## T10.1 — Schéma `StockItem` + `StockMovement` (S)

**Dependencies :** T1.7
**Taille :** S

## T10.2 — Server Actions stock + mouvements atomiques (S)

**Dependencies :** T10.1
**Taille :** S

## T10.3 — UI stock + alertes (M)

**AC :**
- [ ] Table + filtres
- [ ] Badges seuil min / expiration proche
- [ ] Modal mouvement

**Dependencies :** T10.2
**Taille :** M

## Checkpoint Phase 10

- [ ] 5 articles seedés (1 sous seuil, 1 proche péremption)

---

# Phase 11 — Recall + Recherche globale Cmd+K

## T11.1 — Schéma `RecallReminder` + génération auto (S) *(idée #3)*

**AC :**
- [ ] Modèle Prisma + statuts
- [ ] Hook après création de `MedicalRecord` avec traitement `nettoyage` ou `controle_annuel` : crée un `RecallReminder` programmé

**Dependencies :** T6.3
**Taille :** S

## T11.2 — Server Actions recalls + cron envoi (M) *(idée #3)*

**AC :**
- [ ] `listRecalls`, `disableRecall`, `regenerateRecall`
- [ ] Route `/api/cron/recall-reminders` (quotidien 09:00)
- [ ] Envoi WhatsApp template `checkup_reminder` + email
- [ ] Flag `sentAt` + statut → `envoyé`
- [ ] Bonus : si patient prend RDV correspondant après envoi, statut → `rdv_pris`

**Dependencies :** T11.1, T4.4
**Taille :** M

## T11.3 — UI page recalls (S) *(idée #3)*

**AC :** `/recalls` avec liste, filtres, actions désactiver/renvoyer.
**Dependencies :** T11.2
**Taille :** S

## T11.4 — Recherche globale Cmd+K (M) *(idée #9)*

**AC :**
- [ ] Composant `<CommandPalette />` (shadcn Command)
- [ ] Server Action `globalSearch(query, types[])` : Promise.all sur 4 sous-requêtes (patients FTS, RDV par patient/dentiste/date, factures par numéro, stock par nom)
- [ ] Résultats groupés par type, navigation clavier
- [ ] Actions rapides (Créer patient, Nouveau RDV, etc.)
- [ ] Debounce 150 ms
- [ ] Raccourci `Cmd+K` / `Ctrl+K` global depuis le layout

**Verification :** temps de réponse < 200 ms avec 500 patients seedés.
**Dependencies :** T2.2, T4.2, T9.2, T10.2
**Taille :** M

## Checkpoint Phase 11

- [ ] Recall envoyé sur patient seedé avec consultation `nettoyage` du J-180
- [ ] Cmd+K trouve patient en < 200 ms

---

# Phase 12 — Dashboard

## T12.1 — Server functions KPIs admin/dentiste/réceptionniste (M)

**AC :**
- [ ] `getAdminKpis(range)` : CA mois, CA en attente, patients actifs, RDV semaine, top 5 traitements, taux d'occupation, plans en retard, recalls dus, articles sous seuil
- [ ] `getDentistKpis(dentistId, range)`
- [ ] `getReceptionistTodo()`
- [ ] Cache `unstable_cache` 60s

**Dependencies :** Phases 2, 4, 5, 6, 9
**Taille :** M

## T12.2 — UI dashboard adapté au rôle + Recharts (M)

**AC :**
- [ ] `/` route le dashboard selon rôle
- [ ] Cards KPIs + 2 graphes Recharts (CA mensuel + répartition traitements pour admin)
- [ ] Skeletons + empty states
- [ ] Tous textes i18n

**Dependencies :** T12.1
**Taille :** M

## Checkpoint Phase 12

- [ ] Dashboard < 1s en preview Vercel
- [ ] **Revue humaine** : pertinence KPIs

---

# Phase 13 — i18n finalisation, audit, polish, deploy

## T13.1 — Compléter toutes les traductions FR / EN / AR (M)

**AC :**
- [ ] Audit : aucune string en dur dans `app/` ni `components/`
- [ ] Les 3 fichiers `messages/*.json` complets et cohérents
- [ ] Tests visuels chaque page en AR (RTL OK)

**Dependencies :** toutes UI
**Taille :** M

## T13.2 — Helper audit log appliqué partout + UI audit (S)

**AC :**
- [ ] Toutes les Server Actions sensibles appellent `audit()`
- [ ] `/settings/audit-log` (admin) avec filtres

**Dependencies :** T2.2
**Taille :** S

## T13.3 — Polish global (S)

**AC :** skeletons, empty states avec illustrations, toasts `sonner`, pages 404/500.
**Dependencies :** toutes
**Taille :** S

## T13.4 — Tests E2E Playwright (5 parcours) (M)

**AC :** les 5 tests référencés dans les checkpoints tournent en CI.
**Dependencies :** —
**Taille :** M

## T13.5 — Déploiement Vercel + Neon prod (S)

**AC :**
- [ ] Vercel lié au repo, env vars (DATABASE_URL, DIRECT_URL, AUTH_SECRET, RESEND_API_KEY, CLOUDINARY_*, WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN, CRON_SECRET, AUTH_TRUST_HOST, NEXTAUTH_URL)
- [ ] `prisma migrate deploy` en `postinstall`
- [ ] Neon main + branches éphémères PR
- [ ] Smoke test `/api/health`

**Dependencies :** toutes
**Taille :** S

## T13.6 — Documentation README + runbook (S)

**AC :**
- [ ] `README.md` (install, scripts, env vars)
- [ ] `docs/runbook.md` (créer admin, sauvegarde DB, rotation secrets, ajout cabinet)
- [ ] `docs/whatsapp-templates.md` (4 templates × 3 langues à pré-approuver Meta)
- [ ] `.env.example` à jour

**Dependencies :** T13.5
**Taille :** S

## Checkpoint final

- [ ] 5 tests E2E verts en CI
- [ ] Smoke prod OK
- [ ] Démo seedée (1 cabinet, 2 dentistes, 5 patients trilingues, 3 RDV, 1 facture, 1 plan paiement, 1 odontogramme rempli, 1 recall programmé)
- [ ] **Revue humaine finale** : acceptation V1

---

## Risques et mitigations

| Risque | Impact | Mitigation |
|---|:-:|---|
| **Approbation templates WhatsApp Meta** : peut prendre 24-72h | Haut | Soumettre les 12 templates (4 × 3 langues) dès la Phase 0 ; prévoir fallback email si non approuvés |
| **Verrouillage anti-double-attribution liste d'attente** | Haut | Advisory lock Postgres + transaction sur l'`acceptProposal` |
| **Coût Cloudinary** avec photos avant/après nombreuses | Moyen | Limite 10 MB/upload + auto-quality + monitoring quota |
| **i18n trilingue ralentit la livraison** | Moyen | Discipline dès Phase 0 (helper i18n + interdiction strings en dur) + revue chaque phase |
| **RTL casse certains composants shadcn** | Moyen | Audit RTL en T1.6 et T13.1, classes logiques `ms-*/me-*` |
| **Numérotation facture aléatoire vs conformité loi** | Haut | Point de départ aléatoire à la création du cabinet, **séquentiel ensuite** — pas de gap |
| **Multi-tenant fuites de données** | Haut critique | Middleware Prisma + tests Vitest dédiés cross-tenant + review T1.3 |
| **Auth.js v5 changements API** | Moyen | Version épinglée |
| **Performance Cmd+K avec gros volume** | Faible | Debounce + index trigram + LIMIT 10 par type |
| **Templates Meta refusés (langue AR rare)** | Moyen | Tester soumission AR tôt, prévoir variantes |

## Questions ouvertes (cf. SPEC §12)

- Q1 — Backup radios hors Cloudinary ?
- Q2 — Signature dentiste : où la déposer ?
- Q5 — Durée légale archivage dossier médical Maroc
- Q6 — Stock par lots ou quantité globale ?
- **Q7 — Rédaction des 12 templates WhatsApp** — **BLOQUANT avant Phase 4**
- **Q8 — Logo cabinet (svg/png) + couleurs de marque** — **BLOQUANT avant Phase 4** (PDF + topbar)

## Parallélisation possible

Après Phase 1 :
- Phase 2 (Patients) ∥ Phase 3 (Dentistes) ∥ Phase 10 (Stock)
- Phase 7 (Odontogramme) ∥ Phase 8 (Prescriptions) après Phase 6
- Phase 11 (Recall/Cmd+K) ∥ Phase 12 (Dashboard) après Phase 9
