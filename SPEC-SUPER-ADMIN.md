# SPEC — Plateforme Super-Admin (Platform Owner)

> **Type** : analyse d'écarts + roadmap priorisée
> **Produit** : DentalCare — SaaS de gestion pour cabinets dentaires (Fès, Maroc)
> **Périmètre** : l'espace `/super-admin` (propriétaire de plateforme, rôle `SUPER_ADMIN`)
> **Complément du** cahier des charges principal [`SPEC.md`](SPEC.md)
> **Dernière révision** : juin 2026

---

## 1. Objectif & contexte

Le **super-admin** est le **propriétaire de la plateforme** (pas l'admin d'un cabinet). Il a une visibilité **cross-tenant** sur tous les cabinets et porte la responsabilité de :

- **Faire entrer le revenu** (abonnements, conversions d'essai, recouvrement).
- **Garder la plateforme saine** (uptime, intégrations WhatsApp/IA, jobs).
- **Servir les cabinets** (support, onboarding assisté, communication).
- **Rester conforme** — on manipule des **données médicales** sensibles, hébergées pour le Maroc (loi **09-08 / CNDP**), et des données personnelles (RGPD si patients UE).

**Contraintes techniques** : Next.js 16 (App Router) · Prisma 7 · Postgres (Neon) · pnpm · auth maison (argon2) · multi-tenant par `clinicId`. Le rôle `SUPER_ADMIN` est rattaché à une pseudo-clinique « Platform ».

**Principe directeur** : un super-admin de SaaS médical doit pouvoir **tout observer**, **agir avec parcimonie**, et **laisser une trace** (audit) de chaque action sensible.

---

## 2. Cartographie de l'existant

| Domaine | Page / Action | État |
|---|---|---|
| Vue d'ensemble | `/super-admin` (KPIs MRR, cabinets, tickets, sparkline, activité) | ✅ |
| Cabinets | `/clinics` + `/clinics/[id]` (liste + détail, `getClinicDetail`) | ✅ lecture |
| Abonnements | `/subscriptions` (MRR, par plan, tableau, switch de plan) | ✅ |
| Plan / statut | `setClinicPlan`, `setClinicSubscription`, extension d'essai | ✅ manuel |
| Business Intelligence | `/business-intelligence` (MRR/ARR, cohortes de churn, proxy NPS, signups) | ✅ |
| Support | `/support` + `/support/[id]` (`listAllTickets`, priorité, statut) | ✅ |
| Utilisateurs | `/users` (`getPlatformUsers`) | ⚠️ **lecture seule** |
| Audit | `/audit` (journal d'actions) | ✅ |
| Monitoring | `/monitoring` (`getMonitoringSnapshot`) | ✅ instantané |

**Tarification** : branchée sur la source unique `lib/billing/plan-pricing.ts` (Starter 0, Pro 300/mois, Cabinet+ 2000/an). MRR annualisé correctement (÷12) — *corrigé lors de l'audit de juin 2026*.

---

## 3. Ce qu'un super-admin de SaaS dentaire DOIT avoir — par domaine

Légende priorités : **P0** = bloquant pour opérer un vrai SaaS payant · **P1** = important (risque/efficacité) · **P2** = confort/croissance.

### 3.A — Revenu & abonnements

| Capacité attendue | Existant | Écart | Prio |
|---|---|---|---|
| Encaissement réel (Stripe/paiement) | ❌ « once wired » dans le code | **Aucun paiement réel** : MRR théorique, pas de facturation des cabinets, pas de carte | **P0** |
| Cycle de vie d'abonnement auto (essai → actif → impayé → annulé) piloté par webhooks | Statut **manuel** uniquement | Pas de transition auto, pas de dunning/relances | **P0** |
| Factures **émises aux cabinets** (reçus d'abonnement) | ❌ | Aucun justificatif côté plateforme | **P1** |
| MRR / ARR / par plan / churn / conversion | ✅ (BI + subscriptions) | OK (chiffres maintenant justes) | — |
| Coupons / remises / essais custom | extension d'essai seule | Pas de codes promo ni tarif négocié | **P2** |
| Alerte « impayé > N jours » | partiel (projeté si conversion) | Pas d'alerte proactive d'impayé | **P1** |

### 3.B — Conformité & sécurité

| Capacité attendue | Existant | Écart | Prio |
|---|---|---|---|
| **Export RGPD/CNDP par cabinet** (toutes les données d'un tenant) | export **patient** existe (côté cabinet) | Pas d'export **cabinet entier** côté plateforme | **P0** |
| **Suppression / offboarding** d'un cabinet (purge conforme + délai de grâce) | ❌ | Impossible de clôturer proprement un cabinet | **P0** |
| **Impersonation** sécurisée (« se connecter en tant que ») pour le support — consentement + audit | ❌ | Le support ne peut pas reproduire le contexte d'un cabinet | **P1** |
| Politique de **rétention** des données médicales (durée légale) appliquée | ❌ | Pas de purge programmée ni de règle | **P1** |
| **Audit log** des actions sensibles (plan, statut, impersonation, suppression) | ✅ existe | Vérifier la **couverture** de chaque action sensible | **P1** |
| **2FA / MFA** sur le compte super-admin + restriction IP | ❌ | Compte god-mode sans second facteur | **P1** |
| Registre **DPA / consentement** des cabinets | partiel | Pas de suivi central | **P2** |
| Souveraineté des données (hébergement, sous-traitants) documentée | infra Neon EU | À clarifier vis-à-vis CNDP | **P1** |

### 3.C — Support & santé plateforme

| Capacité attendue | Existant | Écart | Prio |
|---|---|---|---|
| File de tickets, priorité, statut, SLA | ✅ (`/support`) | OK | — |
| **Alertes proactives** : passerelle WhatsApp HS, quota IA, jobs Inngest en échec | snapshot manuel | Pas de **push d'alerte** (il faut ouvrir la page) | **P1** |
| Statut des **intégrations** par cabinet (WhatsApp connecté ? IA active ?) | partiel (monitoring) | Vue par cabinet à consolider | **P1** |
| Suivi d'**erreurs** (Sentry-like) + logs corrélés | ❌ | Pas de capture d'erreurs centralisée | **P1** |
| Page **statut** / historique d'incidents | ❌ | Pas de communication d'incident | **P2** |
| Métriques d'usage (RDV, messages IA, volume) par cabinet | partiel (BI global) | Granularité par cabinet limitée | **P2** |

### 3.D — Gestion cabinets & utilisateurs

| Capacité attendue | Existant | Écart | Prio |
|---|---|---|---|
| Liste + détail cabinet | ✅ | OK | — |
| **Suspendre / réactiver** un cabinet (lock d'accès, distinct du billing) | statut billing seul | Pas de « gel » indépendant du paiement | **P1** |
| Gestion **utilisateurs** : désactiver, reset mot de passe, renvoyer invitation, changer rôle | ⚠️ **lecture seule** | Aucune action possible sur les comptes | **P1** |
| **Onboarding assisté** d'un nouveau cabinet (le wizard auto a été retiré) | ❌ | Pas d'outil de setup côté plateforme | **P2** |
| **Communication** : bannière de maintenance, annonce produit, email broadcast | ❌ | Pas de canal plateforme → cabinets | **P2** |
| **Feature flags / capacités de plan** éditables depuis l'UI | code (`plan-capabilities.ts`) | Modif = déploiement, pas d'UI | **P2** |
| Création « concierge » d'un cabinet (onboarding commercial) | signup public seul | Pas de création manuelle | **P2** |

---

## 4. Exigences transverses (boundaries de conception)

- **Toute action sensible** (changer plan/statut, impersonation, suspension, suppression, reset mot de passe) **DOIT** : (1) exiger `SUPER_ADMIN`, (2) écrire dans l'**audit log** (qui, quoi, quand, cible), (3) être **réversible** ou protégée par confirmation explicite.
- **Données médicales** : jamais affichées en clair dans les vues plateforme agrégées ; l'accès au contenu d'un cabinet passe par l'impersonation tracée, pas par des requêtes cross-tenant silencieuses.
- **Isolation tenant** : toute requête super-admin reste explicitement cross-tenant et auditée — ne jamais fuiter les helpers cross-tenant vers le code cabinet.
- **Idempotence** : les scripts de provisioning (`scripts/create-platform-owner.ts`) restent idempotents.

---

## 5. Critères d'acceptation des écarts P0

**P0-1 — Paiement & cycle de vie automatique**
- [ ] Intégration paiement (Stripe ou fournisseur MA : CMI / PayZone) : abonnement créé à l'activation du plan.
- [ ] Webhooks : `paid` → `ACTIVE` ; échec → `PAST_DUE` (+ relance) ; annulation → `CANCELLED`.
- [ ] Le MRR affiché = somme réellement facturée (réconcilié avec le fournisseur).
- [ ] Reçu/facture d'abonnement disponible côté cabinet.

**P0-2 — Export & offboarding cabinet (conformité)**
- [ ] Bouton « Exporter toutes les données du cabinet » (ZIP : patients, RDV, factures, notes, odontogramme).
- [ ] Flux d'offboarding : suspension → délai de grâce (ex. 30 j) → purge conforme, le tout audité.
- [ ] Journalisation CNDP/RGPD de l'export et de la suppression.

---

## 6. Roadmap priorisée

> Statut au 2026-06 : ✅ fait · 🟡 partiel · ⬜ à faire.
> Hors roadmap mais livré : **fix MRR** (prix périmés 499/999 → source unique, Cabinet+ annualisé).

| # | Item | Domaine | Prio | Effort | Statut |
|---|---|---|---|---|---|
| 1 | Intégration paiement + cycle de vie par webhooks | Revenu | **P0** | L | ⬜ différé (décision propriétaire — conservé au backlog) |
| 2 | Export & offboarding cabinet conforme (RGPD/CNDP) | Conformité | **P0** | M | ⬜ |
| 3 | Actions sur utilisateurs (désactiver / reset / rôle) | Cabinets & users | **P1** | S | ✅ |
| 4 | Suspendre / réactiver un cabinet (lock indépendant du billing) | Cabinets & users | **P1** | S | ✅ |
| 5 | Impersonation sécurisée + audit (support) | Conformité/Support | **P1** | M | ✅ |
| 6 | Alertes proactives (WhatsApp HS, jobs, quota IA) + capture d'erreurs | Santé plateforme | **P1** | M | 🟡 visibilité dashboard (push = reste) |
| 7 | 2FA super-admin + restriction d'accès | Sécurité | **P1** | S | ⬜ écarté |
| 8 | Alerte impayé > N jours + factures d'abonnement | Revenu | **P1** | S | 🟡 alerte impayé (factures = reste) |
| 9 | Bannière / annonce plateforme → cabinets | Communication | **P2** | S | ✅ |
| 10 | Feature flags / capacités de plan éditables en UI | Cabinets & users | **P2** | M | ⬜ |
| 11 | Coupons / tarifs négociés | Revenu | **P2** | M | ⬜ |
| 12 | Page statut + métriques d'usage par cabinet | Santé plateforme | **P2** | M | 🟡 usage/cabinet (page statut publique = reste) |

---

## 7. Boundaries

**Toujours**
- Exiger `SUPER_ADMIN` + auditer toute action d'écriture cross-tenant.
- Garder la tarification sur la source unique `plan-pricing.ts`.
- Confirmer explicitement avant toute action destructive (suppression cabinet/utilisateur).

**Demander d'abord**
- Toute intégration de paiement (choix fournisseur MA vs Stripe, TVA, devise).
- Politique de rétention / durée légale des données médicales au Maroc.
- Avant d'activer l'impersonation (cadre de consentement des cabinets).

**Jamais**
- Exposer des données médicales en clair dans des vues agrégées.
- Supprimer/purger un cabinet sans délai de grâce ni audit.
- Donner `SUPER_ADMIN` sans second facteur en production.
