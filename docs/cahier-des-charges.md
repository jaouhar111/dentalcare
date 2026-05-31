# Cahier des charges — DentalCare

> **AI Dental Front Desk — la réceptionniste WhatsApp 24/7 pour cabinets dentaires au Maroc**
> Version 1.1 · 31 mai 2026 · Mehdi El Jaouhar
>
> Positionnement produit : **« l'IA qui remplace la réceptionniste »**, pas
> « encore un logiciel de gestion ». Toute fonctionnalité hors-AI est
> secondaire et doit servir ce positionnement.

---

## 1. Contexte & enjeu

### 1.1 Le marché
Au Maroc, on dénombre environ **8 500 chirurgiens-dentistes** répartis sur 4 500 cabinets, dont **>60 % à Casablanca, Rabat et Fès**. Plus de **70 % des prises de RDV** se font par WhatsApp, et la majorité des cabinets utilise encore un **cahier papier + Excel** pour le planning.

### 1.2 Le problème
- 30 à 50 messages WhatsApp / jour par cabinet
- 2 h 15 / jour en moyenne perdues à répondre
- 1 patient sur 3 qui contacte un cabinet hors horaires n'aura jamais de réponse
- 15 à 25 % de no-shows non rappelés
- Recalls (détartrage, contrôle annuel) oubliés
- Pas de visibilité fine sur les revenus, plans de paiement, stock

### 1.3 La proposition de valeur

**« L'AI Receptionist qui ne dort jamais. »**

Là où la concurrence vend « un logiciel de gestion », nous vendons **un
remplacement** de la réceptionniste pour les heures et messages qu'aucune
secrétaire humaine ne peut couvrir. Un bot IA WhatsApp parle français,
anglais et darija, prend les RDV, gère les urgences, envoie les rappels
et les recalls. **Le logiciel cabinet (calendrier, factures, dossiers)
est l'environnement, pas le produit.**

Promesse au dentiste, en une phrase :

> **« Le téléphone arrête de sonner. Les patients arrivent au RDV. Toi, tu soignes. »**

Ce positionnement guide trois règles produit :

1. **Tout écran a UN objectif principal** — pas de tableau de bord à 12 cartes.
2. **L'IA est ON par défaut** — pas un module à activer dans un sous-menu.
3. **Chaque feature non-AI doit pouvoir justifier sa présence** par
   « sans ça, le bot ne peut pas faire son travail ».

---

## 2. Objectifs mesurables

### 2.1 Métriques produit (orientées cabinet)
| Objectif | Cible v1 |
|---|---|
| Temps gagné par cabinet/jour | **≥ 1 h 30** |
| Réduction du taux de no-shows | **−42 %** (mesuré sur cabinets avec rappel J-1 actif) |
| Délai de réponse aux messages patients | **< 30 s** (vs jusqu'à 12 h en manuel) |
| RDV pris hors horaires d'ouverture (22 h–8 h) | **≥ 20 %** du total |
| % des RDV créés par le bot IA (vs manuel) | **≥ 40 %** à 6 mois d'usage |
| Taux de réponse IA sans handover humain | **≥ 85 %** |
| Latence moyenne bot (parse → send) | **< 5 s** p95 |

### 2.2 Métriques business (orientées plateforme)
| Objectif | Cible v1 |
|---|---|
| Cabinets sous contrat à 12 mois | **30** cabinets payants |
| MRR à 12 mois | **15 000 MAD/mois** |
| ARR estimé à 12 mois | **180 000 MAD** |
| Conversion essai → payant | **≥ 30 %** |
| Churn mensuel | **≤ 5 %** |
| CAC (Customer Acquisition Cost) | **≤ 500 MAD** par cabinet |
| LTV estimé (Cabinet+ × 24 mois) | **≥ 12 000 MAD** par cabinet |
| LTV / CAC | **≥ 20** (objectif sain SaaS) |

---

## 3. Personas

### 3.1 Dr Hdoud — Propriétaire / dentiste (cible principale)
- 40 ans, exerce depuis 12 ans, cabinet à Fès
- 2 dentistes salariés, 1 réceptionniste
- ~600 patients actifs
- N'aime pas les outils complexes — veut « ouvrir le logiciel et voir mon planning du jour, c'est tout »
- Mobile et tablette à parts égales

### 3.2 Sara — Réceptionniste
- 28 ans, gère le calendrier + WhatsApp toute la journée
- Stressée quand 5 patients écrivent en même temps
- Veut un seul outil qui montre RDV + facture + chat WhatsApp

### 3.3 Dr Otmane — Dentiste salarié
- 32 ans, partage le cabinet 3 jours / semaine
- A besoin de voir SES créneaux et ses dossiers patients uniquement
- Pas d'accès à la compta ni aux paramètres

### 3.4 Mehdi — Propriétaire plateforme (SUPER_ADMIN)
- Surveille MRR, conversions, tickets support
- Active / désactive les cabinets, change leurs plans
- Reçoit les tickets quand un cabinet est bloqué

---

## 4. Périmètre fonctionnel

### 4.1 Authentification & multi-tenant
- Inscription self-service (formulaire `/signup`)
- Login email / mot de passe (Auth.js v5, JWT 7 jours)
- Reset password (token 30 min)
- 4 rôles : `SUPER_ADMIN`, `ADMIN` (propriétaire cabinet), `DENTIST`, `RECEPTIONIST`
- Chaque ligne de la base est scopée par `clinicId` — isolation totale entre cabinets

### 4.2 Patients
- CRUD complet : identité, contact, langue préférée, canal préféré (WhatsApp / Email)
- Soft-delete (`deletedAt`)
- Dossier médical : antécédents, allergies, médicaments en cours, notes cliniques timestampées
- **Odontogramme** anatomique SVG : 32 dents permanentes (notation FDI), 5 surfaces par dent (vestibulaire, linguale, mésiale, distale, occlusale/incisive), 10 conditions (saine, carie, plombage, couronne, implant, dévitalisée, à extraire, absente, fracture, prothèse), historique chronologique par dent
- Radiographies : upload Cloudinary, vignette + zoom
- Photos cliniques : avant/après par traitement
- Ordonnances PDF
- Recherche : nom, téléphone, email

### 4.3 Rendez-vous
- Calendrier 3 vues : jour, semaine, mois
- Drag-and-drop pour déplacer un RDV
- Filtrage par dentiste (couleur unique par praticien)
- Étiquettes source : `MANUAL` (créé en clinique) / `AI_WHATSAPP` (créé par le bot) / `PATIENT_PORTAL`
- Statuts : SCHEDULED → CONFIRMED → COMPLETED / CANCELLED / NO_SHOW
- Liste d'attente avec préférences (dentiste, horaires, date butoir) et proposition automatique sur annulation
- Vue mobile responsive

### 4.4 Rappels automatiques (Inngest)
| Type | Déclencheur | Canal |
|---|---|---|
| **J-1** | 24 h avant `startAt` | WhatsApp template (fallback texte) |
| **Rappel matin** | 8h00 Casablanca le jour-même | WhatsApp |
| **Recall détartrage** | +6 mois après acte « détartrage » | WhatsApp |
| **Recall contrôle** | +12 mois après dernier contrôle | WhatsApp |
| **Relance facture** | J-3, J-1, J+3 d'une échéance | WhatsApp |

Idempotence stricte : chaque rappel a son propre flag (`reminderSentAt`, `morningReminderSentAt`…) — pas de double envoi possible.

### 4.5 Bot IA WhatsApp — l'AI Receptionist (multi-tenant, produit central)
- Webhook `/api/webhooks/whatsapp` — signature HMAC-SHA256 vérifiée
- Routing par `metaPhoneNumberId` → cabinet
- Compréhension texte + audio (Gemini Flash multimodal)
- Réponse texte + voix synthétisée (Gemini TTS → MP3)
- 3 langues : français, anglais, darija
- Outils typés : `getSchedule`, `bookAppointment`, `cancelAppointment`, `rescheduleAppointment`, `proposeUrgentSlot`, `getClinicHours`
- Garde anti-spoofing : un patient ne peut prendre un RDV que pour lui-même (famille / amis refusés)
- Conversations persistées dans `AIConversation` + handover possible vers humain
- Audit complet de chaque tour
- **Kill switch global par cabinet** — toggle `AI Receptionist : ON/OFF` dans `/settings`. OFF = le bot répond « Je vous transfère, un instant » et crée un ticket handover automatique.

### 4.5.bis Automatisations avancées (Phase 11)
Au-delà du booking-de-base, l'AI Receptionist orchestre tout le cycle de vie d'un RDV :

| Automation | Déclencheur | Action |
|---|---|---|
| **Auto-confirmation** | Rappel J-1 envoyé → quick-reply « Je confirme » | RDV passe en `CONFIRMED`, pas d'action manuelle |
| **Auto-cancel no-response** | Rappel J-1 + rappel matin → 0 réponse à H-2h | RDV libéré, créneau proposé à la waitlist, notif au cabinet |
| **Auto-reschedule intelligent** | Patient écrit « je peux pas venir » | Le bot propose 3 créneaux compatibles (préférences + dispo dentiste) et exécute le swap sans intervention |
| **Suggestions créneaux optimisés** | Cabinet crée un RDV manuel | Le bot suggère le créneau qui maximise l'occupation (gap minimum entre RDV) |
| **Détection patient à risque no-show** | 2 no-shows historiques | Le bot demande pré-confirmation 48 h à l'avance + dépôt CB (Phase 7) |

### 4.6 Facturation
- Génération PDF (numérotation conforme TVA, numéro de départ randomisé pour masquer le volume)
- Multi-mode : espèces, virement, carte, chèque
- TVA 20 % avec mention si > seuil
- Plans de paiement 3 / 6 / 12 mensualités avec relances WhatsApp J-3, J-1, J+3
- Vue "factures impayées" avec total restant
- Conformité loi 09-08

### 4.7 Stock
- Catalogue consommables (composite, anesthésique, brosses…)
- Mouvements (entrée / sortie / inventaire) avec auteur tracé
- Alertes seuil (notif sidebar)

### 4.8 Conversations IA admin
- Page `/conversations` : threads WhatsApp réels en temps réel
- Badge non-lus dans sidebar (polling 15s)
- Handover : un admin peut « reprendre » la conversation et écrire à la place du bot
- Filtre par statut (active / handed-off / closed)

### 4.9 Support tickets
- Cabinet ouvre un ticket : 7 catégories (bug, how-to, billing, WhatsApp, account, feature request, other) × 4 priorités (low, normal, high, urgent)
- Thread iMessage-style entre cabinet et plateforme
- Transitions auto : OPEN → IN_PROGRESS (super-admin a répondu) → WAITING_USER → IN_PROGRESS → RESOLVED
- Réouverture : toute nouvelle réponse réactive un ticket résolu

### 4.10 Super-admin (cross-tenant) — tableau de contrôle business + infra
Le super-admin n'est PAS un utilisateur métier. C'est un **tableau de contrôle SaaS** orienté revenu + santé plateforme.

#### 4.10.1 Dashboard global
- Bandeau urgence si tickets ouverts ou WhatsApp en panne
- 4 KPI business : **MRR · Cabinets · Activité IA 7j · Conversion**
- 1 sparkline (inscriptions 30j) + activity feed temps réel
- 3 cartes par-plan (Starter/Pro/Cabinet+) avec count + MRR

#### 4.10.2 Liste cabinets
Chaque ligne :
- nom, slug, plan, statut, MRR généré, patients, **activité 7j**, **last login**, **usage WhatsApp (msg/jour)**
- Actions inline : Activer · +jours essai (presets + custom) · Switcher plan · Marquer impayé · **Reset onboarding** · Suspendre

#### 4.10.3 Page abonnements (Phase 7+)
- MRR par plan, ARR projeté, churn financier mensuel
- Table cabinets avec inline switch + popover prolongation
- Liste **paiements échoués** (à corréler avec PAST_DUE)
- Export CSV facturation

#### 4.10.4 Monitoring IA & WhatsApp ★ NEW (Phase 10)
**Critique : si WhatsApp casse = business cassé.** Page dédiée `/super-admin/monitoring` :
- Messages IA / jour (graphique)
- **Taux de réponse IA vs handover humain**
- Erreurs webhook WhatsApp (compteur + dernier message d'erreur)
- Latence moyenne bot (parse → AI → send) — p50, p95, p99
- Échecs envoi messages (template rejected, phone not in allowlist, etc.)
- Templates Meta : statut approbation, dernière mise à jour
- **Alerte Slack** automatique si > 5 % d'erreurs sur 5 min ou latence > 10 s

#### 4.10.5 Support inbox
- Cross-cabinet avec filtres status / priorité / catégorie
- **SLA tracking** : temps de première réponse, temps de résolution
- **Détection tickets récurrents** : si 3+ cabinets ouvrent un ticket sur le même bug → alerte « bug système probable »

#### 4.10.6 Utilisateurs cross-tenant
- Toutes les comptes de la plateforme
- Recherche par email, cabinet, rôle
- Logs login suspects (multi-IP en < 1 min, ratelimit triggered, etc.)

#### 4.10.7 Registre d'audit
- Tracé exhaustif des actions sensibles
- Filtre par cabinet, par acteur, par action
- **Cross-tenant access blocked** events visibles (tentative IDOR détectée)

#### 4.10.8 Billing system global (Phase 7)
- Revenus par plan / par mois
- Factures générées (count + total)
- Paiements échoués → liens vers cabinet detail
- Churn financier (cabinets qui sont passés à CANCELLED ce mois)

### 4.11 Marketing / Landing page
- Page publique apple.com-style (nav noir translucide, hero massif, story cards alternées)
- 3 plans visibles (Starter 0 / Pro 499 / Cabinet+ 999 MAD)
- Inscription self-service 14 jours gratuits sans CB
- FR / EN bascule en 1 clic
- Open Graph configuré
- PWA installable (manifest.webmanifest)

### 4.12 Onboarding guidé ★ NEW (Phase 10)
À la création d'un cabinet, un **wizard 5 étapes (≤ 5 min total)** s'ouvre automatiquement et bloque les autres écrans tant qu'il n'est pas terminé :

1. **Connecter WhatsApp** : saisir le Phone Number ID Meta (ou « pas maintenant », mode dégradé)
2. **Horaires** : 7 toggles jour/soir avec heures défaut (9-12, 15-19)
3. **Dentistes** : ajouter au moins 1 dentiste (nom, spécialité, couleur)
4. **Importer patients** : CSV ou « commencer à vide »
5. **Activer le bot IA** : choisir style (formel / amical), langue par défaut, signature

À la fin : confettis + redirect vers le dashboard avec tutorial overlay (3 spotlights : agenda, inbox WhatsApp, paramètres). Skip possible à tout moment.

### 4.13 Dashboard cabinet (ADMIN/DENTIST/RECEPTIONIST) ★ ENRICHI
**Règle : 1 écran = 1 objectif = « ce que je dois faire MAINTENANT ».**

#### 4.13.1 Au-dessus de la ligne de flottaison
- **RDV du jour** : liste timeline cliquable, badge IA si créé par bot, statut couleur
- **RDV de demain** : aperçu light (compteur + 3 prochains)
- **WhatsApp inbox preview** : 5 dernières conversations actives, badge non-lus, bouton « Voir tout »

#### 4.13.2 KPI strip (4 tuiles Apple flat)
- **Revenus du mois** (MAD) — vs mois précédent
- **Taux no-show 30j** (%) — alerte si > 15 %
- **RDV confirmés** (count + ratio vs total)
- **RDV en attente confirmation** — call-to-action si > 5

#### 4.13.3 Below the fold
- Patients récents (5 derniers ajoutés)
- Alertes stock (si applicable)
- **Banner essai** si jour > 7 sur 14 (urgence amber si ≤ 3 j restants)

### 4.14 Analytics IA cabinet ★ NEW (Phase 12)
Page `/insights` accessible aux ADMIN du cabinet. Démontre le ROI du bot pour transformer l'essai en payant :

| Carte | Donnée |
|---|---|
| **RDV créés par l'IA** | Count + % du total · ce mois |
| **Revenus générés par l'IA** | Σ des factures pour RDV de source AI_WHATSAPP |
| **Temps économisé** | (msg IA × 90s) ÷ 60 → heures/mois |
| **Top 5 questions traitées** | « Vous êtes ouverts mardi ? », « j'ai mal », etc. — montre la couverture |
| **Pic horaire** | Histogramme des messages reçus par heure → prouve le 22h-8h |
| **Patients récupérés** | Ceux qui ont écrit hors horaires et auraient été perdus sans le bot |

### 4.15 Paramètres cabinet ★ ENRICHI
Au-delà des horaires + dentistes + WhatsApp Phone ID :
- **AI Receptionist** : toggle ON/OFF, style (formel/amical), langue par défaut, signature personnalisée
- **Templates IA** : 5 réponses-types éditables par le cabinet (« demande RDV », « urgence », « horaires », « adresse », « hors-sujet ») — surchargent les défauts
- **Règles no-show** : nombre de no-shows avant marquage « patient à risque », action automatique (pré-confirmation 48h / dépôt CB)
- **Règles waitlist** : combien de patients notifiés par créneau libéré (1 / 3 / tous)
- **Templates WhatsApp** : aperçu + lien direct vers Meta Business pour gérer l'approbation

---

## 5. Spécifications techniques

### 5.1 Stack

| Couche | Choix | Pourquoi |
|---|---|---|
| Framework | **Next.js 16** (App Router + Turbopack) | RSC, Server Actions, perf, écosystème |
| UI | **Tailwind v4 + shadcn/ui** + tokens Apple | Velocité, accessibilité Radix |
| Langue | **TypeScript** strict | Zéro `any`, contrats vérifiés à la compile |
| i18n | **next-intl 4** (FR / EN) | RSC-first, namespaces |
| Base de données | **Prisma 7 + Neon Postgres** | Type-safe, serverless, branching |
| Auth | **Auth.js v5** (JWT, session 7j) | Pas de table session — RSC rapides |
| Event-driven | **Inngest 4** (cron + sleeps durables) | Remplace Vercel crons, durable, dashboard |
| IA | **Gemini Flash** + Groq fallback | Quota gratuit 1500 req/jour, latence faible |
| WhatsApp | **Meta Cloud API** + System User token | Officiel, multi-cabinet par phone_number_id |
| Email | **Resend** (planifié) | Templates React Email, deliverability |
| Files | **Cloudinary** (logo, radios) | CDN, transformations à la volée |
| Monitoring | **Sentry** + replay | Erreurs + tracing |
| Hosting | **Vercel** (prod) + **Neon** (DB) | Edge runtime, scaling auto |

### 5.2 Architecture
- **App Router + RSC** : presque tout en Server Components, `"use client"` minimal
- **Server Actions** pour toutes les mutations (typage end-to-end via `Result<T>`)
- **Middleware (`proxy.ts`)** : check cookie présence (sans décoder JWT) + next-intl routing
- **`auth()` mémoïsé par requête** via React `cache()` — décodé une seule fois par render
- **Multi-tenant strict** : `clinicId` sur chaque ligne, `requireRole` vérifie + `me.clinicId` filtre
- **Event Outbox** : mutations DB + événements Inngest dans la même transaction, dispatch asynchrone

### 5.3 Performance (objectifs mesurables)
- p50 page response **< 1 s** (mesuré : middleware 51-280ms après optim)
- p99 page response **< 3 s**
- Bot WhatsApp temps de réponse **< 5 s** en moyenne (parse → AI → send)
- Cold start **< 1 s** (Vercel Edge où possible)
- Bundle landing page **< 200 KB** gzip
- Lighthouse Performance **≥ 90**

### 5.4 Sécurité

**Headers** (configurés dans `next.config.ts`) :
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`

**Auth** :
- Cookies `httpOnly`, `secure`, `sameSite: lax`
- Bcrypt 12 rounds (à migrer Argon2)
- Rate-limit login : 5 fail / 15 min, lockout 15 min
- Reset password : token 32 bytes, hashé, 30 min, single-use

**Webhook WhatsApp** :
- HMAC-SHA256 `timingSafeEqual` vs `X-Hub-Signature-256`
- **Refus en prod si `WHATSAPP_APP_SECRET` manquant** (fail-closed)

**Server Actions** :
- Validation Zod à chaque entrée
- `requireRole` à chaque mutation, SUPER_ADMIN bypass explicite
- Audit log de toutes les actions sensibles

**Secrets** :
- Aucun secret dans le code ni dans git
- `.env` non committé
- Rotation documentée (`docs/operations/security-rotation.md`)

### 5.5 Données & conformité loi 09-08

| Donnée | Localisation actuelle | Cible v1.1 |
|---|---|---|
| Patients (PII) | Neon Postgres eu-central-1 (Frankfurt) | Migration Maroc (Houda / GenIS) |
| Radiographies, photos | Cloudinary CDN global | Cloudinary Europe |
| Logs application | Sentry US | Sentry EU |
| WhatsApp messages | Meta servers (US/EU) | Inchangé — accord patient à la souscription |

**Action immédiate** :
- Mention CGU + politique confidentialité à la création du cabinet
- Consentement explicite WhatsApp à la création patient
- Bouton "Exporter mes données" + "Supprimer mon compte" (à venir Phase 8)
- Déclaration CNDP pour chaque cabinet (responsabilité du cabinet, document type fourni)

---

## 6. Modèle économique

| Plan | Prix HT | Cible |
|---|---|---|
| **Starter** | 0 MAD / mois | Découverte, 1 dentiste, ≤100 patients, rappels J-1, factures PDF |
| **Pro** | 499 MAD / mois | Le plus populaire, 3 dentistes, patients illimités, **bot IA WhatsApp**, recalls auto, plans paiement, 5 utilisateurs |
| **Cabinet+** | 999 MAD / mois | Grandes équipes, dentistes & utilisateurs illimités, **voice notes IA**, support prioritaire, onboarding |

- 14 jours d'essai gratuit sur tous les plans, sans carte bancaire
- Annulation 1-clic depuis `/settings`
- Facturation mensuelle, paiement par CMI (planifié Phase 7) ou virement
- TVA 20 % en sus

---

## 7. Roadmap

### ✅ Phases livrées (mai 2026)
- **Phase 0** — Fondations (UI, DB, i18n)
- **Phase 1** — Auth + multi-tenant
- **Phase 2** — Patients (CRUD, dossier médical, odontogramme)
- **Phase 3** — RDV (calendrier 3 vues, drag-drop, liste d'attente)
- **Phase 4** — Factures, paiements, plans de paiement
- **Phase 5** — Rappels (J-1, recall détartrage, rappel 8h matin)
- **AI 1-6** — Bot WhatsApp complet (texte + voix, FR/EN/Darija, multi-tenant)
- **Super-admin** — Dashboard, cabinets, abonnements, support, audit
- **Landing page** — Marketing apple.com-style, inscription self-service
- **Support tickets** — Cabinet ↔ super-admin two-way

### 🚧 Phase 6 — Traitements avancés (Q3 2026)
- Catalogue traitements éditable par cabinet
- Plan de traitement multi-étapes avec validation patient
- Génération devis PDF
- Suivi des actes par patient

### 🚧 Phase 7 — Billing production (Q3 2026)
- Intégration **CMI** (Maroc) ou Stripe (international)
- Webhook signature verify
- Auto-cancel à expiration paiement
- Génération facture mensuelle automatique
- Dunning emails (relances)

### 🚧 Phase 8 — Conformité 09-08 (Q4 2026)
- Migration DB Maroc (alternative à Neon Frankfurt)
- Déclaration CNDP par cabinet (documents types)
- Export données patient (RGPD-style)
- Suppression compte avec preuve de conservation 10 ans

### 🚧 Phase 9 — Production hardening (Q4 2026)
- Rate-limit Upstash (multi-instance safe)
- CSP avec nonces (next-safe-middleware)
- Sentry alertes critiques sur Slack
- Backup automatique DB quotidien
- App Review Meta WhatsApp → Advanced Access (envoi sans allowlist)
- Documentation onboarding cabinet (vidéos + guide PDF)

### 🚧 Phase 10 — AI Receptionist as product (Q4 2026) ★ PRIORITAIRE
Le pivot positionnement : on arrête de vendre « un logiciel », on vend « la réceptionniste IA ».
- **Toggle global AI Receptionist ON/OFF** par cabinet
- **Onboarding wizard** 5 étapes en ≤ 5 min (cf. § 4.12)
- **Page Monitoring IA & WhatsApp** super-admin (cf. § 4.10.4) avec alerte Slack
- Refonte landing : « AI Front Desk » au lieu de « SaaS cabinet »
- Refonte dashboard cabinet : RDV du jour + inbox WhatsApp en hero, le reste below-fold (cf. § 4.13)
- Page settings « AI Receptionist » dédiée (style, langue, signature, templates personnalisables)
- Démo vidéo 60s sur la landing montrant un vrai échange WhatsApp end-to-end

### 🚧 Phase 11 — Smart automation (Q1 2027)
Automatisations agressives qui font passer le bot de « répond aux messages » à « gère le cycle de vie complet d'un RDV » :
- **Auto-confirmation** sur quick-reply « Je confirme » au J-1
- **Auto-cancel + libération** créneau si silence à H-2h (et proposition à la waitlist)
- **Auto-reschedule intelligent** : patient écrit « je peux pas », bot propose 3 créneaux, exécute le swap
- **Suggestions créneaux optimisés** lors de la création manuelle (minimise les gaps)
- **Détection patient à risque no-show** : 2 no-shows → pré-confirmation 48h + dépôt CB
- **Smart waitlist promotion** : un patient libère, le bot priorise par préférences + score (date, dentiste, urgence)

### 🚧 Phase 12 — Business intelligence (Q1 2027)
Les chiffres qui vendent — pour le super-admin **et** pour le cabinet :
- **Cabinet ROI dashboard** (`/insights`) : RDV générés par l'IA, revenus générés par l'IA, temps économisé, patients récupérés hors horaires (cf. § 4.14)
- **Top 5 questions** par cabinet et globalement (sert au prompt engineering du bot)
- **Heatmap horaire** : quand les patients écrivent, quand le bot répond
- **Super-admin BI** : ARR, churn cohort-by-cohort, CAC/LTV par canal d'acquisition, NPS auto-calculé depuis les tickets résolus
- **Export PDF** mensuel automatique « Votre bot ce mois » envoyé à chaque cabinet par email — preuve continue de valeur, réduit le churn

---

## 8. Critères d'acceptation v1

> **Légende** : `[x]` = livré et vérifié · `[~]` = partiellement livré · `[ ]` = à faire
> **Dernière revue** : 31 mai 2026 — après refonte super-admin + perf + sécu

### 8.1 Performance
- [ ] p50 page response < 1 s (mesuré sur 100 requêtes consécutives)
- [x] Middleware proxy.ts < 200 ms *(mesuré 51-284 ms après wrap `cache()` + cookie-only check — voir [src/proxy.ts](../src/proxy.ts))*
- [ ] Bot WhatsApp temps de réponse < 5 s p95
- [ ] Lighthouse Performance ≥ 90 sur landing
- [ ] `pnpm build` < 60 s

### 8.2 Sécurité
- [x] 5 headers sécu présents en prod (HSTS, X-Frame, nosniff, Referrer, Permissions) *(vérifié via `curl -I` — voir [next.config.ts](../next.config.ts))*
- [ ] `npm audit` : 0 critical, 0 high
- [~] Aucun secret en clair dans `git log -p` *(plusieurs creds exposés en dev chats — rotation documentée dans [security-rotation.md](operations/security-rotation.md), à exécuter avant prod)*
- [x] Webhook WhatsApp refuse si signature manquante OU creds manquants en prod *(fail-closed — voir [src/lib/whatsapp/client.ts:247](../src/lib/whatsapp/client.ts))*
- [ ] Tests pen IDOR : impossible d'accéder à une donnée d'un autre cabinet via id deviné
- [x] Rate-limit login efficace (test : 6e tentative en 15 min refusée) *(in-memory — voir [src/lib/auth/rate-limit.ts](../src/lib/auth/rate-limit.ts) ; passer à Upstash en Phase 9 pour multi-instance)*

### 8.3 Multi-tenant
- [x] Cabinet A ne voit JAMAIS les données du cabinet B *(architecture `clinicId` + `requireRole` partout — pen test formel reste à faire)*
- [x] SUPER_ADMIN voit tout *(bypass explicite ligne [rbac.ts:57](../src/lib/auth/rbac.ts) ; vérifié sur `/super-admin/clinics/[id]`)*
- [x] Webhook WhatsApp route correctement par `metaPhoneNumberId` *(`resolveClinic` + fallback dev)*
- [x] Conversation dans cabinet A n'apparaît pas dans cabinet B *(table `AIConversation` portée par `clinicId`, queries scoped)*

### 8.4 Fonctionnel
- [x] Création cabinet → essai 14 j auto, statut TRIAL *(signupAction fixe `trialEndsAt = now + 14j`)*
- [x] J-13 → bandeau urgence amber en settings *(carte [subscription-card.tsx](../src/app/[locale]/(dashboard)/settings/subscription-card.tsx) gère seuil `≤ 3j`)*
- [x] J0 essai expiré → redirect /billing au prochain accès *(paywall layout-level)*
- [x] Bot WhatsApp prend un RDV de bout en bout en < 30 s *(testé live AI 1-6, livré)*
- [x] J-1 reminder + rappel 8h matin envoient bien *(`pnpm tsx scripts/test-morning-reminder.ts` passe — pipeline validée)*
- [x] Support ticket : cabinet → super-admin → cabinet → résolu *(thread complet livré — pages `/support`, `/super-admin/support`)*

### 8.5 UX
- [x] Mobile responsive (375×667 min) *(MobileSidebarDrawer + grids responsive)*
- [x] Tablet (iPad 768×1024) → odontogramme et calendrier confortables *(chart SVG en `viewBox`, calendar drag-drop fonctionnel)*
- [x] FR / EN bascule instantanée sur landing + dashboards *(namespace `Landing` + `Nav` traduits, toggle dans nav)*
- [x] Toutes les actions sensibles ont une confirmation dialog *(`ConfirmDialogProvider` câblé)*
- [x] Toaster sur chaque action async *(`sonner` `<Toaster />` global)*
- [ ] **Onboarding wizard ≤ 5 min** chronométré → Phase 10
- [~] **« 1 écran = 1 objectif »** → super-admin dashboard refait Apple-flat ✓, cabinet dashboard à simplifier (Phase 10)
- [ ] **AI Receptionist toggle visible** dans les paramètres en moins de 2 clics → Phase 10

### 8.6 AI Receptionist (Phase 10-11)
- [ ] AI ON par défaut à la création du cabinet
- [ ] Toggle OFF → bot répond avec « Je vous transfère » + crée ticket handover
- [ ] ≥ 85 % des messages traités sans handover humain (mesuré sur 100 conversations)
- [ ] Auto-confirmation quick-reply fonctionne end-to-end
- [ ] Auto-cancel à H-2h sur silence libère le créneau et propose à la waitlist
- [ ] Auto-reschedule via texte libre propose 3 créneaux et exécute le swap

### 8.7 Business intelligence (Phase 12)
- [ ] Page `/insights` montre RDV-créés-par-IA + revenus + temps économisé pour chaque cabinet
- [ ] Page `/super-admin/monitoring` montre messages/jour, latence, échecs en temps réel
- [ ] Alerte Slack super-admin si > 5 % d'erreurs webhook sur 5 min
- [ ] Export PDF mensuel envoyé à chaque cabinet (« Votre bot ce mois »)

---

## 8.bis Bilan livré au 31 mai 2026

**Items cochés : 18 / 39 (46 %)**

| Section | Livré | Total | Statut |
|---|---|---|---|
| 8.1 Performance | 1 | 5 | 🟡 *(perf middleware OK, reste perf globale + Lighthouse)* |
| 8.2 Sécurité | 3 + 1 partiel | 6 | 🟢 *(critiques OK, audit npm + pen test IDOR à faire)* |
| 8.3 Multi-tenant | 4 | 4 | 🟢 *(architecture complète ; manque pen test formel)* |
| 8.4 Fonctionnel | 6 | 6 | 🟢 *(toutes les briques v1 fonctionnelles)* |
| 8.5 UX | 5 + 1 partiel | 8 | 🟡 *(socle OK ; onboarding + dashboard simplifié = Phase 10)* |
| 8.6 AI Receptionist | 0 | 6 | 🔴 *(Phase 10-11 non commencée)* |
| 8.7 Business intelligence | 0 | 4 | 🔴 *(Phase 12 non commencée)* |

**Prochaines priorités** :
1. Phase 10 — AI Receptionist as product (toggle + onboarding + monitoring)
2. Phase 6 — Traitements avancés (plan + devis)
3. Phase 7 — Billing CMI production
4. Tests : pen IDOR + Lighthouse + npm audit + rotation secrets

---

## 9. Hors-périmètre v1

- App mobile native (la PWA suffit)
- Téléconsultation vidéo
- Intégration avec laboratoires de prothèse
- Imagerie 3D / CBCT
- Comptabilité complète (DSN, social)
- CRM marketing complexe (campagnes ciblées, segmentation)
- Multi-devise (MAD uniquement v1)
- Multi-pays (Maroc uniquement v1)
- Marketplace produits dentaires
- Module formation continue

---

## 10. Équipe & gouvernance

- **Owner / Tech lead / Développement** : Mehdi El Jaouhar (`elmehdijaouhar@gmail.com`)
- **Conseil dentaire** : Dr Otmane Hdoud (cabinet pilote, Fès)
- **Support N1** : auto-géré via tickets jusqu'à 20 cabinets payants
- **Hébergement** : Vercel (app), Neon (DB), Cloudinary (assets), Sentry (monitoring)

---

## 11. Annexes

| Document | Contenu |
|---|---|
| [`docs/operations/whatsapp-setup.md`](operations/whatsapp-setup.md) | Setup WhatsApp Cloud API (dev) |
| [`docs/operations/whatsapp-prod-per-clinic.md`](operations/whatsapp-prod-per-clinic.md) | Onboarding WhatsApp pour un nouveau cabinet (prod) |
| [`docs/operations/security-rotation.md`](operations/security-rotation.md) | Rotation calendrier secrets |
| [`docs/whatsapp-templates.md`](whatsapp-templates.md) | Texte des 4 templates Meta (FR/EN) |
| [`public/landing/README.md`](../public/landing/README.md) | Specs + prompts AI pour images marketing |

---

## 12. Glossaire

| Terme | Définition |
|---|---|
| **Cabinet** | Tenant = un cabinet dentaire. Une ligne dans `Clinic`. |
| **Super-admin** | Propriétaire de la plateforme (Mehdi). Accès cross-tenant. |
| **RDV** | Rendez-vous = `Appointment` |
| **Recall** | Rappel automatique à 6 ou 12 mois (détartrage, contrôle) |
| **WABA** | WhatsApp Business Account |
| **Phone Number ID** | Identifiant 15-chiffres Meta pour un numéro WhatsApp |
| **MRR** | Monthly Recurring Revenue |
| **Loi 09-08** | Loi marocaine sur la protection des données personnelles |
| **CNDP** | Commission Nationale de contrôle de la protection des Données à caractère Personnel |
| **CMI** | Centre Monétique Interbancaire (paiement Maroc) |
| **FDI** | Fédération Dentaire Internationale (notation des dents 11-48) |
| **Inngest** | Plateforme de workflows event-driven (cron + sleeps durables) |
| **RSC** | React Server Component |

---

*Document maintenu dans le dépôt — toute modification de périmètre fait l'objet d'un PR.*
