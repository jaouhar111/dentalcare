# SPEC — DentalCare Management System

> Application web de gestion de cabinet dentaire. MVP destiné aux cabinets de Fès, extensible au Maroc (architecture multi-tenant préparée dès V1).
>
> Version : 1.1 — révision du 2026-05-12 (Prisma, WhatsApp, trilingue, odontogramme, ajouts métier 2-5/7-9)

---

## 1. Présentation

**Nom du projet :** DentalCare Management System
**Cible :** Cabinets dentaires (mono-cabinet en V1, multi-cabinet préparé techniquement)
**Marché initial :** Fès → Maroc
**Plateforme :** Web responsive (desktop prioritaire, tablette secondaire)

### 1.1 Stack technique retenu

| Couche | Choix | Justification |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server Actions, RSC, déploiement Vercel natif |
| Langage | TypeScript (strict) | Type safety end-to-end |
| UI | Tailwind CSS + shadcn/ui | Composants accessibles, audit RTL prévu pour l'arabe |
| Base de données | Neon (PostgreSQL serverless) | Branching DB par environnement, scale-to-zero |
| **ORM** | **Prisma** | Schéma déclaratif, migrations `prisma migrate`, client typé. Neon : `DATABASE_URL` pooled (`pgbouncer=true`) + `DIRECT_URL` pour migrations |
| Auth | Auth.js v5 (NextAuth) | Credentials + JWT, Argon2id |
| **i18n** | **next-intl** | Trilingue **FR / EN / AR (RTL)** dès V1, locale par défaut FR |
| Calendrier | FullCalendar React | Vue jour/semaine/mois, drag & drop, support RTL |
| Upload | Cloudinary | Radios, photos avant/après, URLs signées |
| **Notifications** | Resend (email) + **WhatsApp Cloud API (Meta)** | Rappels RDV, confirmations, recall, liste d'attente. Templates pré-approuvés Meta |
| PDF | `@react-pdf/renderer` | Devis*, factures, ordonnances ; support RTL |
| Charts | Recharts | Composable React |
| Validation | Zod | Server Actions + forms |
| Forms | React Hook Form + Zod resolver | DX |
| Recherche | Postgres FTS + `pg_trgm` | Recherche globale Cmd+K + recherche patient |
| Tests | Vitest + Playwright | Unitaires + 5 parcours E2E critiques |
| Hébergement | Vercel | Preview par PR, Neon branch éphémère par PR |

> *Devis : pas retenu en V1 (idée #1 écartée par l'utilisateur). Les PDF V1 sont **factures** + **ordonnances** uniquement.

---

## 2. Objectifs

- **O1** — Digitaliser les opérations quotidiennes du cabinet (zéro papier sur l'admin)
- **O2** — Réduire les erreurs administratives (doublons RDV, factures perdues)
- **O3** — Automatiser les rappels RDV J-1 + confirmation 1-clic par WhatsApp
- **O4** — Centraliser les dossiers médicaux, radios et photos avant/après
- **O5** — Générer des rapports financiers fiables (CA, paiements en attente, plans échelonnés)
- **O6** — Suivre le stock médical avec alertes seuil bas et expiration
- **O7** — Maximiser le taux d'occupation du cabinet (liste d'attente RDV auto)
- **O8** — Fidéliser les patients via les rappels de contrôle (recall) automatiques
- **O9** — Préparer l'extension multi-cabinet dès V1 (architecture multi-tenant)

---

## 3. Utilisateurs et rôles (RBAC)

### 3.1 Rôles

| Rôle | Description |
|---|---|
| **Admin** | Gère utilisateurs, paramètres globaux, accès à toutes les données du cabinet |
| **Dentiste** | Consulte ses patients, ajoute diagnostics/traitements/ordonnances, voit son agenda |
| **Réceptionniste** | Crée/modifie patients, gère le planning, encaisse paiements |

> *Patient* (réservation en ligne) reste **hors V1**.

### 3.2 Matrice de permissions V1

| Action | Admin | Dentiste | Réceptionniste |
|---|:-:|:-:|:-:|
| Gérer utilisateurs (CRUD) | ✅ | ❌ | ❌ |
| Voir tous les patients | ✅ | ✅ | ✅ |
| Créer/modifier patient | ✅ | ✅ | ✅ |
| Supprimer patient (soft) | ✅ | ❌ | ❌ |
| Voir/modifier dossier médical | ✅ | ✅ | ❌ |
| Uploader radios + photos avant/après | ✅ | ✅ | ❌ |
| Modifier odontogramme | ✅ | ✅ | ❌ |
| Créer/modifier RDV | ✅ | ✅ | ✅ |
| Gérer liste d'attente | ✅ | ❌ | ✅ |
| Créer ordonnance | ✅ | ✅ | ❌ |
| Émettre facture | ✅ | ✅ | ✅ |
| Créer plan de paiement échelonné | ✅ | ❌ | ✅ |
| Encaisser paiement | ✅ | ❌ | ✅ |
| Gérer stock | ✅ | ❌ | ✅ |
| Voir dashboard global | ✅ | ❌ | ❌ |
| Configurer recall (rappels contrôle) | ✅ | ✅ | ❌ |
| Recherche globale Cmd+K | ✅ | ✅ | ✅ |

---

## 4. Périmètre fonctionnel V1

### 4.1 Authentification

- Login email/mot de passe (Argon2id)
- Logout, reset password (lien signé, 30 min)
- Sessions JWT 7 jours
- Verrouillage après 5 tentatives échouées (15 min, in-memory V1)
- Mot de passe ≥ 8 caractères

**Hors V1 :** 2FA (idée #6 écartée par l'utilisateur), OAuth providers, portail patient.

### 4.2 Gestion patients

**Champs :**
- Identité : prénom*, nom*, CIN, date de naissance*, genre, photo
- Contact : téléphone* (E.164 `+212…`), email, adresse, ville
- Médical : groupe sanguin, allergies (multi-tag), antécédents, médecin traitant
- **Préférences communication** : canal préféré (WhatsApp / email / téléphone), langue préférée (fr/en/ar)
- **Consentement photos** : autorisation/refus de photos avant-après (booléen + date)
- Méta : créé par, créé le, dernière visite

**Opérations :** CRUD, soft delete, recherche FTS (nom/CIN/téléphone), liste paginée (50/page), tri.

**Règles :**
- CIN unique par cabinet (contrainte composite `(clinic_id, cin)`)
- Téléphone normalisé E.164 marocain
- Tous les patients scopés par `clinic_id` (multi-tenant)

### 4.3 Gestion dentistes

- Profil : prénom, nom, spécialité, téléphone, email, photo, couleur agenda
- Horaires de travail : jour de semaine + plages horaires (multi-plages par jour)
- Indisponibilités ponctuelles : congés, formations

### 4.4 Rendez-vous

**Création :** patient + dentiste + date/heure + durée + motif + canal de contact.

**Statuts :** `programmé`, `confirmé`, `en_cours`, `terminé`, `annulé`, `absent`, `replanifié`.

**Vues :** jour / semaine / mois (FullCalendar), filtre multi-dentistes (couleur par dentiste).

**Règles métier :**
- Pas de chevauchement pour un même dentiste (transaction + détection serveur)
- Doit respecter les plages de travail et les absences
- Annulation < 24h → flag `annulation_tardive` (statistiques)

#### 4.4.1 Rappels et confirmation WhatsApp 1-clic

- **J-1 à 18:00** (cron Vercel) : envoi WhatsApp + email selon `canal préféré`
- **Message WhatsApp** : template Meta pré-approuvé "appointment_reminder" en langue patient (fr/en/ar)
- Le message contient deux boutons : `✅ Confirmer` / `📅 Demander à reporter`
- Réception via **webhook Meta** → met à jour le statut RDV (`confirmé`) ou crée une demande de replanification visible par la réceptionniste
- Si email préféré ou WhatsApp indisponible : email avec lien signé (token unique) → page de confirmation
- Flag `reminder_sent_at` + `confirmation_received_at` sur le RDV pour éviter doublons

#### 4.4.2 Liste d'attente automatisée *(idée #2)*

- Patient peut être ajouté à une **liste d'attente** : dentiste préféré (optionnel), durée souhaitée, plage horaire idéale (matin/après-midi/jour précis), date limite
- Statuts entrée : `en_attente`, `proposé`, `accepté`, `refusé`, `expiré`
- Sur **annulation** d'un RDV → recherche automatique des entrées de liste d'attente **compatibles** (dentiste, durée, plage)
- Notification WhatsApp envoyée aux candidats par ordre d'ancienneté
- Premier qui clique `✅ J'accepte` se voit attribuer le créneau (race-condition gérée côté serveur via verrou advisory)
- Délai d'attente proposition : 15 min, puis passage au suivant

### 4.5 Dossier médical, radiographies et photos avant/après

**Dossier médical :** une entrée par consultation (liée à un RDV terminé ou création manuelle). Champs : date, dentiste, motif, examen clinique, diagnostic, plan de traitement, notes.

**Timeline patient :** chronologique inverse des consultations.

**Radiographies :**
- Upload multi (jpg, png, dicom-jpg)
- Type (panoramique, rétro-alvéolaire, bite-wing, etc.)
- Dent concernée (FDI) optionnel
- Cloudinary dossier `clinics/{clinicId}/patients/{id}/xrays/`
- URL signée 1h

**Photos avant / après *(idée #8)* :**
- Upload sous le dossier médical, **liées à un traitement appliqué**
- Type : `before` / `after`
- Métadonnée : date, traitement référencé, dent (optionnel)
- Vue comparée côte-à-côte
- **Consentement obligatoire** : flag patient `consentement_photos` requis avant upload
- Cloudinary dossier `clinics/{clinicId}/patients/{id}/treatment-photos/`

### 4.6 Traitements

**Catalogue (admin) :** nom, catégorie, prix par défaut, durée estimée.

**Catégories V1 :** extraction, implant, blanchiment, orthodontie, nettoyage, soin carie, dévitalisation, couronne, bridge.

**Application :**
- Lié à un dossier médical
- Numéro de dent (notation FDI 11-48)
- Statut : `planifié`, `en_cours`, `terminé`
- Prix réel, remise éventuelle

### 4.7 Prescriptions

- Items : médicament, dosage, fréquence, durée, instructions
- Génération PDF (`@react-pdf/renderer`) avec en-tête cabinet, signature scannée, **bilingue** (langue patient + arabe par défaut)
- Téléchargement et envoi par email/WhatsApp au patient

### 4.8 Facturation et plans de paiement

**Émission de facture :**
- Génération depuis les traitements terminés d'une consultation, ou manuelle
- **Numérotation : point de départ aléatoire** (entier dans `[1000, 9999]`, fixé à la création du cabinet via paramètre `invoice_starting_number`), puis **strictement séquentiel** ensuite. Format `F-2026-7842`, `F-2026-7843`, etc.
- Préserve la conformité loi marocaine (numéros consécutifs, pas de gap)
- Lignes : description, quantité, prix unitaire, total
- Total HT, TVA configurable (0% par défaut sur les actes médicaux au Maroc), total TTC
- Statuts : `brouillon`, `émise`, `payée_partielle`, `payée`, `annulée`
- Paiements : montant, méthode (espèces, carte, virement, chèque), date
- Export PDF (langue patient + arabe)

**Plan de paiement échelonné *(idée #7)* :**
- Activé manuellement sur une facture (typiquement implant, orthodontie)
- Définition : nombre d'échéances (2 à 24), montant initial (acompte optionnel), périodicité (mensuelle/personnalisée)
- Calcul automatique des échéances + dates
- Liaison `payment_plan_installments ↔ payments`
- **Relances automatiques** : WhatsApp 3 jours avant échéance, et 1 jour après si non payé
- Statuts plan : `actif`, `terminé`, `en_retard`, `annulé`
- Vue patient : échéancier visuel avec restant dû

### 4.9 Stock

- Articles : nom, catégorie, référence, unité, quantité, seuil min, date d'expiration, fournisseur
- Mouvements : entrée, sortie, ajustement, péremption (avec utilisateur)
- Alertes : badge rouge si `quantity ≤ min_threshold`, badge orange si expiration < 30 j

### 4.10 Dashboard

**Admin :**
- KPIs : CA mois, CA en attente (factures émises non payées), nb patients actifs, RDV semaine, top 5 traitements, taux d'occupation cabinet
- Graphes Recharts : CA mensuel 12 mois, répartition traitements (pie), RDV par dentiste (bar)
- Indicateurs : plans de paiement en retard, recalls dus ce mois, articles sous seuil

**Dentiste :**
- RDV du jour + semaine
- Patients récents
- Mes consultations / mois, mon CA généré

**Réceptionniste :**
- RDV du jour avec statut confirmation
- Patients à appeler (RDV J-1 sans confirmation)
- Paiements en attente du jour
- Liste d'attente active

### 4.11 Odontogramme graphique interactif

- **Composant SVG** représentant 32 dents (notation FDI 11-48 + 51-85 pour les dents de lait, V2)
- **Vue patient** : odontogramme affiche l'état courant de chaque dent
- **Conditions par dent** : saine, carie, plombage, couronne, implant, absente, à extraire, dévitalisée, fracture, prothèse
- **Surface concernée** (optionnel) : mésiale, distale, occlusale, vestibulaire, linguale
- **Clic sur dent** → panneau latéral : conditions actuelles + historique
- **Modes** :
  - Lecture (tous rôles)
  - Édition (dentiste/admin) : ajouter une condition ou un traitement planifié
- **Code couleur** : vert (saine), rouge (carie), bleu (plombage), gris (absente), or (couronne), etc.
- Données stockées dans `dental_chart_entries` (historisé : chaque entrée a une date, on garde la dernière par défaut)
- **Génération du plan de traitement** depuis l'odontogramme : sélectionner les dents marquées → créer traitements correspondants en un clic

### 4.12 Rappels de contrôle automatiques (recall) *(idée #3)*

- Types : `detartrage` (tous les 6 mois), `controle_annuel` (tous les 12 mois), `suivi_orthodontie` (mensuel pendant traitement)
- **Génération automatique** d'un `recall_reminder` après une consultation du type concerné (ex. après un détartrage, un recall détartrage est créé pour J+180)
- Cron quotidien (Vercel) : pour chaque recall dû (`due_date <= today + 7 jours`) et non envoyé, envoi WhatsApp + email
- Vue admin/dentiste : `/recalls` avec liste, statuts (`programmé`, `envoyé`, `RDV pris`, `expiré`), désactivation manuelle possible
- Template Meta WhatsApp pré-approuvé "checkup_reminder" multilingue

### 4.13 Recherche globale Cmd+K *(idée #9)*

- Palette commande activable par `Cmd+K` (Mac) ou `Ctrl+K` (Win) depuis n'importe quelle page
- Composant shadcn `Command` (Radix Command Menu)
- **Recherche fédérée** :
  - Patients (par nom, CIN, téléphone)
  - RDV (par patient, dentiste, date)
  - Factures (par numéro, patient)
  - Articles stock
- Endpoint Server Action `globalSearch(query, types[])` qui exécute en parallèle 4 sous-requêtes (Promise.all) avec FTS / `pg_trgm`
- Résultats groupés par type, navigation clavier
- Actions rapides : "Créer patient", "Nouveau RDV", "Voir mes RDV aujourd'hui", "Aller au stock"

---

## 5. Architecture technique

### 5.1 Vue d'ensemble

```
Navigateur (React 19, RSC)
        │
        ▼
Next.js 15 App Router  (Vercel)
   ├── Pages (Server Components)
   ├── Server Actions (mutations)
   ├── Route Handlers (webhooks WhatsApp, cron Vercel)
   └── Middleware (auth + RBAC + i18n + clinic context)
        │
        ▼
Prisma → Neon Postgres (pooled + DIRECT_URL pour migrations)
        │
        ├── Cloudinary (radios, photos avant/après, photos patients)
        ├── Resend (emails transactionnels)
        └── Meta WhatsApp Cloud API (rappels, confirmations, recall, plans paiement)
```

### 5.2 Multi-tenant (préparation V1) *(idée #5)*

- Table `clinics` au cœur du modèle : un cabinet = un tenant
- **Toute table métier** porte `clinic_id` FK (patients, dentists, appointments, invoices, stock, etc.)
- Helper `getClinicContext()` extrait `clinic_id` depuis la session utilisateur (chaque user appartient à un cabinet)
- Prisma **middleware** intercepte les requêtes pour injecter automatiquement `where: { clinicId }` sur les modèles tagués
- Permissions : un user ne voit jamais les données d'un autre cabinet
- V1 : seed d'un seul cabinet, mais l'architecture autorise N cabinets sans modification de schéma
- V2 : page d'inscription cabinet + facturation SaaS

### 5.3 Conventions de code

- **Server Actions** pour toutes les mutations
- **Server Components** par défaut, `"use client"` uniquement pour interactivité
- **Validation Zod** systématique côté serveur
- **Erreurs typées** : `Result<T, E>` (jamais d'exception silencieuse côté action)
- **RBAC** : helper `requireRole(['admin','dentist'])` en tête de chaque action sensible
- **Audit log** : middleware automatique sur les mutations sur entités sensibles
- i18n : aucune string en dur en UI (utilisation `useTranslations()` / `getTranslations()`)
- RTL : utilisation des classes Tailwind `ms-*` / `me-*` (au lieu de `ml-*` / `mr-*`)

### 5.4 Structure dossiers

```
src/
├── app/
│   ├── [locale]/                       # next-intl
│   │   ├── (auth)/login/, /reset-password/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx              # shell + sidebar + Cmd+K
│   │   │   ├── page.tsx                # dashboard adapté au rôle
│   │   │   ├── patients/
│   │   │   ├── appointments/
│   │   │   ├── waitlist/
│   │   │   ├── medical-records/
│   │   │   ├── odontogram/[patientId]/
│   │   │   ├── invoices/
│   │   │   ├── payment-plans/
│   │   │   ├── stock/
│   │   │   ├── recalls/
│   │   │   ├── users/                  # admin
│   │   │   └── settings/
│   │   └── api/                        # webhooks (WhatsApp), cron
├── components/
│   ├── ui/                             # shadcn/ui
│   ├── command-palette/                # Cmd+K
│   ├── odontogram/                     # SVG composant
│   └── feature/
├── lib/
│   ├── db/ (prisma client, middlewares)
│   ├── auth/ (config, rbac, clinic-context)
│   ├── i18n/ (config, dictionaries)
│   ├── whatsapp/ (templates, sender, webhook)
│   ├── cloudinary/, resend/
│   └── utils/
├── server/
│   └── actions/ (par domaine)
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── messages/                           # next-intl
│   ├── fr.json
│   ├── en.json
│   └── ar.json
└── types/
```

---

## 6. Modèle de données (Prisma)

> Schéma résumé. Le `schema.prisma` complet sera dérivé.

### 6.1 Entités tenant + auth

```
Clinic (id, name, address, phone, email, vatNumber?, logoUrl?, defaultLocale, invoiceStartingNumber, settingsJson, createdAt)
User (id, clinicId FK, email UNIQUE, passwordHash, role, fullName, dentistId?, isActive, createdAt)
PasswordResetToken (id, userId FK, tokenHash, expiresAt, usedAt?)
```

### 6.2 Domaine clinique

```
Dentist (id, clinicId FK, firstName, lastName, specialty, phone, email, color, photoUrl)
WorkingSchedule (id, dentistId FK, dayOfWeek 0-6, startTime, endTime)
DentistAbsence (id, dentistId FK, startAt, endAt, reason)

Patient (id, clinicId FK, firstName, lastName, cin?, phone, email?, dob, gender, address?, city?,
         bloodGroup?, photoUrl?, medicalHistory?, preferredChannel ['whatsapp','email','phone'],
         preferredLocale ['fr','en','ar'], photoConsent BOOL, photoConsentAt?,
         deletedAt?, createdBy, createdAt)
PatientAllergy (id, patientId FK, label)

Appointment (id, clinicId FK, patientId FK, dentistId FK, startAt, endAt, status,
             reason, notes?, createdBy, createdAt, cancelledAt?, cancellationReason?,
             reminderSentAt?, confirmationReceivedAt?, confirmationToken? UNIQUE)

WaitlistEntry (id, clinicId FK, patientId FK, dentistId? FK, durationMin,
               preferredStartAt?, preferredEndAt?, dayPreferences JSONB,
               status ['en_attente','proposé','accepté','refusé','expiré'],
               proposedAt?, proposedFor (appointmentId)?, expiresAt?, createdAt)

MedicalRecord (id, clinicId FK, patientId FK, dentistId FK, appointmentId? FK, occurredAt,
               reason, clinicalExam?, diagnosis, treatmentPlan?, notes?, createdAt)
Radiograph (id, medicalRecordId FK, cloudinaryPublicId, kind, toothNumber?, caption?, uploadedAt)
TreatmentPhoto (id, medicalRecordId FK, treatmentApplicationId? FK, cloudinaryPublicId,
                kind ['before','after'], takenAt, caption?)

TreatmentCatalog (id, clinicId FK, name, category, defaultPrice, defaultDurationMin, isActive)
TreatmentApplication (id, medicalRecordId FK, treatmentId FK, toothNumber?, surfaces?,
                      price, discount?, status ['planifié','en_cours','terminé'], notes?)

DentalChartEntry (id, clinicId FK, patientId FK, toothNumber (FDI), surfaces?,
                  condition ['saine','carie','plombage','couronne','implant','absente',
                             'à_extraire','dévitalisée','fracture','prothèse'],
                  recordedAt, dentistId FK, medicalRecordId? FK, notes?)

Prescription (id, medicalRecordId FK, issuedAt, pdfUrl?)
PrescriptionItem (id, prescriptionId FK, medication, dosage, frequency, duration, instructions?)

RecallReminder (id, clinicId FK, patientId FK,
                type ['detartrage','controle_annuel','suivi_orthodontie'],
                dueDate, scheduledAt, sentAt?, status ['programmé','envoyé','rdv_pris','expiré','désactivé'],
                appointmentId? FK, sourceMedicalRecordId? FK)
```

### 6.3 Facturation

```
Invoice (id, clinicId FK, number UNIQUE, patientId FK, medicalRecordId? FK,
         status ['brouillon','émise','payée_partielle','payée','annulée'],
         subtotal, taxRate, taxAmount, total, issuedAt, dueAt?, pdfUrl?, notes?)
InvoiceLine (id, invoiceId FK, label, quantity, unitPrice, total)
Payment (id, clinicId FK, invoiceId FK, amount, method ['cash','card','transfer','check'],
         paidAt, recordedBy, paymentPlanInstallmentId? FK)

PaymentPlan (id, clinicId FK, invoiceId FK, totalAmount, installmentsCount,
             status ['actif','terminé','en_retard','annulé'], createdAt)
PaymentPlanInstallment (id, paymentPlanId FK, dueDate, amount, paidAt?,
                        reminderSentAt?, status ['à_venir','payé','en_retard'])
```

### 6.4 Stock + audit

```
StockItem (id, clinicId FK, name, category, reference?, unit, quantity, minThreshold,
           expiryDate?, supplier?, notes?)
StockMovement (id, stockItemId FK, kind ['in','out','adjust','expired'],
               quantity, occurredAt, userId FK, note?)

AuditLog (id, clinicId FK, userId?, action, entity, entityId, payloadJson, at)
```

### 6.5 Index et contraintes critiques

- `(clinicId, cin)` UNIQUE partial WHERE cin IS NOT NULL — sur `Patient`
- `User.email` UNIQUE global (cross-clinic) — pour éviter collision lors d'extension multi-tenant
- `Appointment(dentistId, startAt)` index pour détection chevauchement + agenda
- GIN trigram (`pg_trgm`) sur `Patient(firstName, lastName, cin, phone)` pour recherche
- GIN sur `Invoice.number` pour recherche
- `Invoice(clinicId, number)` UNIQUE
- `WaitlistEntry(clinicId, dentistId, status, createdAt)` pour matching rapide
- Soft delete : `Patient.deletedAt` filtré par défaut

---

## 7. Surface API / Server Actions

### Conventions

- Toute action retourne `{ ok: true, data } | { ok: false, error: { code, message, fields? } }`
- Auth + RBAC + clinic context vérifiés en tête (`requireRole`, `getClinicContext`)
- Logs d'audit automatiques sur mutations sensibles

### Inventaire (par domaine)

```
auth: signIn, signOut, requestPasswordReset, resetPassword
users (admin): listUsers, createUser, updateUser, deactivateUser

patients: listPatients(query), getPatient, createPatient, updatePatient,
          softDeletePatient, setPhotoConsent, setCommunicationPreferences

dentists: listDentists, getDentist, createDentist, updateDentist,
          setSchedule, addAbsence, removeAbsence

appointments: listAppointments(range, dentistId?), createAppointment,
              updateAppointment, cancelAppointment, markStatus,
              confirmByToken, requestReschedule

waitlist: listWaitlist, addToWaitlist, removeFromWaitlist,
          findCandidatesForSlot(start, end, dentistId), proposeSlot,
          acceptProposal, declineProposal

medicalRecords: getRecord, createRecord, updateRecord,
                addRadiograph, removeRadiograph,
                addTreatmentPhoto, removeTreatmentPhoto

odontogram: getPatientChart, addEntry, updateEntry, removeEntry,
            generatePlanFromChart (créer traitements depuis odontogramme)

treatments: listCatalog, upsertCatalogItem (admin),
            applyTreatment, updateApplicationStatus

prescriptions: createPrescription, generatePdf, emailToPatient, sendWhatsApp

invoices: createInvoice, createFromMedicalRecord, addLine, removeLine,
          emitInvoice, recordPayment, voidInvoice, generatePdf

paymentPlans: createPaymentPlan(invoiceId, installments, startDate),
              recordInstallmentPayment, cancelPaymentPlan,
              listOverdueInstallments

recalls: listRecalls(filters), createRecallFromConsultation,
         disableRecall, regenerateRecall

stock: listStock, createItem, recordMovement,
       listLowStock, listExpiring

dashboard: getAdminKpis(range), getDentistKpis(dentistId, range),
           getReceptionistTodo

search: globalSearch(query, types[]) — patients + appointments + invoices + stock

whatsapp: sendTemplate (interne), processWebhook (route handler)

cron: dailyReminders, dailyRecalls, paymentPlanReminders
```

---

## 8. UX / Navigation

- **Sidebar fixe** : Dashboard, Patients, RDV, Liste d'attente, Dossiers, Odontogramme (via patient), Factures, Plans paiement, Stock, Recalls, Utilisateurs (admin), Paramètres
- **Topbar** : recherche globale (placeholder "Rechercher… `⌘K`"), notifications, langue selector, profil
- **Cmd+K palette** : disponible partout, navigation clavier complète
- **Responsive** : sidebar repliable < 1024px, calendrier vue jour sur mobile
- **Langues** : FR (défaut) / EN / AR ; switcher en topbar ; locale persistée dans cookie
- **RTL** : auto en AR (`<html dir="rtl">`), audit shadcn/ui (`ms-*`, `me-*`)
- **Thème** : clair + dark mode (toggle utilisateur)
- **Loading & empty states** : skeletons + illustrations + CTA

---

## 9. Exigences non-fonctionnelles

### 9.1 Sécurité

- Argon2id pour mots de passe
- Server Actions CSRF-protected (Next.js intégré)
- Rate limit login : 5/15min/IP (in-memory V1, Upstash V2)
- Cookies session : `httpOnly`, `secure`, `sameSite=lax`
- Cloudinary : URLs signées, suppression serveur uniquement
- Webhook WhatsApp signé (HMAC vérifié)
- Token de confirmation RDV : cryptographique (32 bytes URL-safe), single-use
- Aucune donnée sensible dans les logs (payload masqué)
- Env vars Vercel (jamais commit)

### 9.2 Données médicales (loi marocaine 09-08)

- Soft delete patients (rétention 5 ans configurable au niveau cabinet)
- Audit log de tout accès aux dossiers médicaux
- Consentement photos avant/après : flag patient + date
- Chiffrement transit HTTPS, chiffrement repos via Neon
- Export données patient (JSON + PDF) — V1.5

### 9.3 Performance

- TTFB < 500 ms pages principales
- Recherche Cmd+K : résultats < 200 ms (debounce 150 ms + parallèle Promise.all)
- Odontogramme : SVG mémoïsé, click handler localisé (32 dents max)
- Calendrier : pagination par semaine, lazy load

### 9.4 Accessibilité

- WCAG AA, navigation clavier complète (shadcn/Radix)
- Contraste vérifié dans les 3 langues
- Annonces ARIA pour les actions Cmd+K

### 9.5 i18n et l10n trilingue

- **FR** (défaut), **EN**, **AR** (RTL) — dès V1
- next-intl avec messages JSON par locale
- `date-fns/locale` : `fr`, `enUS`, `ar`
- Devise affichée : `1 500,00 DH` (fr/ar), `MAD 1,500.00` (en)
- Téléphone affiché en format local : `0612-345-678` (fr), `+212 6 12 34 56 78` (en)
- PDF (factures, ordonnances) : bilingue **langue patient + arabe** par défaut (mentions légales en arabe)
- Templates WhatsApp Meta : un template par langue, sélection auto selon `Patient.preferredLocale`

### 9.6 WhatsApp Cloud API

- Compte Meta Business + numéro vérifié (utilisateur fournit en setup)
- Templates pré-approuvés en 3 langues :
  - `appointment_reminder` (utility) — rappel J-1 + boutons confirmer/reporter
  - `waitlist_slot_offered` (utility) — proposition créneau libéré
  - `checkup_reminder` (utility) — recall détartrage / contrôle
  - `payment_due` (utility) — rappel échéance plan paiement
- Webhook `/api/webhooks/whatsapp` traite les réponses (boutons + messages texte)
- Quota Meta : 1000 conversations utility gratuites/mois → suffisant V1 (alerte si > 80%)

---

## 10. Environnements et déploiement

| Env | URL | DB Neon | Notes |
|---|---|---|---|
| Dev | localhost:3000 | branche `dev` | Seed 1 cabinet + admin |
| Preview | `<branch>.vercel.app` | branche éphémère | Auto par PR GitHub |
| Prod | `dentalcare.vercel.app` puis domaine | branche `main` | Backups quotidiens Neon |

- CI/CD : GitHub → Vercel preview auto
- Migrations Prisma : `prisma migrate deploy` en `postinstall` Vercel + `DIRECT_URL`
- Cron Vercel :
  - `dailyReminders` quotidien 18:00 (WhatsApp J-1)
  - `dailyRecalls` quotidien 09:00 (recalls dus à J+7)
  - `paymentPlanReminders` quotidien 09:00 (échéances à J+3 et J-1)

---

## 11. Hors périmètre V1

- Portail patient (réservation en ligne)
- Application mobile native
- 2FA (idée écartée par l'utilisateur)
- Devis avant traitement (idée écartée)
- Multi-cabinet *opérationnel* (architecture préparée, mais activation V2)
- Intégration assurance/CNOPS/CNSS
- Téléconsultation
- Export comptable détaillé
- Reconnaissance vocale pour notes
- Dents de lait (notation FDI 51-85) dans odontogramme — V1.5

---

## 12. Hypothèses et questions ouvertes

### Hypothèses

- H1 — Cabinet mono-établissement V1 (multi-tenant préparé, pas activé)
- H2 — Actes médicaux dentaires exonérés TVA Maroc (0% par défaut, configurable)
- H3 — Compte Meta Business + numéro WhatsApp vérifié fourni par l'utilisateur avant Phase 4
- H4 — Cloudinary plan gratuit suffit pour démarrer
- H5 — Un dentiste = un utilisateur dédié
- H6 — Numéro de départ facture stocké en `Clinic.invoiceStartingNumber` (généré au seed via `crypto.randomInt(1000, 9999)`)

### Questions ouvertes

- Q1 — **Sauvegarde radios** : backup S3 froid en plus de Cloudinary ?
- Q2 — **Signature dentiste** : upload comme image PNG par dentiste dans son profil ?
- Q5 — **Conformité** : durée légale archivage dossier médical Maroc ?
- Q6 — **Stock** : gestion par lots/numéros de série, ou quantité globale ?
- Q7 — **Templates WhatsApp** : qui rédige les messages métier (4 templates × 3 langues = 12 textes à pré-approuver Meta) ?
- Q8 — **Logo cabinet** : fourni en svg/png pour PDF + topbar ?

> Q7 et Q8 doivent être réglés avant Phase 4.
