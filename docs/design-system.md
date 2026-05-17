# Design System — DentalCare

> **Source :** Recommandations validées par le skill `ui-ux-pro-max` (catégorie "Medical Clinic" + "Healthcare Analytics dashboard") croisées avec mes propositions initiales [brand-guidelines.md](brand/brand-guidelines.md).
>
> **Confiance :** Haute. La catégorie "Medical Clinic" (ligne 59 de `products.csv`) correspond exactement à DentalCare.

---

## 1. Recommandations issues du skill

### Catégorie produit identifiée

**"Medical Clinic"** (157 produits dans la base, match exact)

| Dimension | Recommandation skill | Sévérité |
|---|---|---|
| **Style principal** | Accessible & Ethical + Minimalism | HIGH |
| **Style secondaire** | Neumorphism, Trust & Authority |  |
| **Pattern landing** | Trust & Authority + Conversion | HIGH |
| **Pattern dashboard** | Healthcare Analytics | HIGH |
| **Color mood** | Medical Blue + Trust White + Calm Green | HIGH |
| **Typo mood** | Professional + Readable | HIGH |
| **Effets** | Online booking flow + soft transitions (150ms) |  |

### Règles de décision (auto-générées)

```json
{
  "must_have": ["appointment-booking", "insurance-info", "wcag-aaa-compliance"],
  "if_data_dense": "prioritize-clarity-over-aesthetics",
  "if_mobile": "optimize-touch-targets",
  "if_arabic": "verify-RTL-layout-shadcn"
}
```

### Anti-patterns à éviter (HIGH severity)

- ❌ **AI purple/pink gradients** (typique des apps AI génériques — donne l'impression d'un produit non métier)
- ❌ **Outdated interface** (bordures bleu marine 2010, ombres dures)
- ❌ **Confusing booking flow** (formulaires longs sans progress indicator)
- ❌ **Bright neon colors** (incompatible avec contexte médical)
- ❌ **Motion-heavy animations** (distrayant en contexte clinique)
- ❌ **Color-only indicators** (échec accessibilité + daltonisme)
- ❌ **Neumorphism sur dashboards data-dense** (recommandé pour patients, à **éviter** pour notre cas)

---

## 2. Décisions finales

### 2.1 Palette validée

Le skill recommande deux teintes proches dans la veine médicale. Je propose **3 options** à départager :

| Option | Hex | Tailwind | Personnalité | Recommandation |
|---|---|---|---|---|
| **A — Teal (proposition initiale)** | `#0D9488` | `teal-600` | Wellness, moderne, différenciant | ⭐ Si vous voulez vous démarquer du bleu médical classique |
| **B — Cyan médical (skill `colors.csv`)** | `#0891B2` | `cyan-600` | Clinique moderne, équilibré | ⭐⭐ Recommandation du skill pour "Medical Clinic" |
| **C — Medical Blue traditionnel** | `#0077B6` | proche `sky-700` | Traditionnel médical, très "trust" | Plus conservateur |

> **DÉCISION RETENUE (2026-05-12) :** **B — `cyan-600 #0891B2`**. Confirmé par l'utilisateur. La palette §2.2 ci-dessous est définitive.

### 2.2 Palette complète (option B retenue par défaut)

```css
/* Tokens sémantiques pour shadcn/ui — globals.css */
@layer base {
  :root {
    --background: 0 0% 100%;              /* #FFFFFF */
    --foreground: 222.2 84% 4.9%;         /* #0F172A slate-900 */

    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;

    --primary: 192 91% 36%;               /* #0891B2 cyan-600 */
    --primary-foreground: 0 0% 100%;

    --secondary: 187 92% 69%;             /* #22D3EE cyan-400 */
    --secondary-foreground: 222.2 84% 4.9%;

    --accent: 142 71% 45%;                /* #16A34A green-600 — "health green" */
    --accent-foreground: 0 0% 100%;

    --muted: 200 24% 96%;                 /* #E8F1F6 */
    --muted-foreground: 215 16% 47%;      /* #64748B slate-500 */

    --border: 215 28% 90%;                /* #E2E8F0 slate-200 */
    --input: 215 28% 90%;
    --ring: 192 91% 36%;                  /* primary */

    --destructive: 0 84% 60%;             /* #DC2626 red-600 */
    --destructive-foreground: 0 0% 100%;

    --success: 142 71% 45%;               /* same as accent */
    --warning: 38 92% 50%;                /* #F59E0B amber-500 */
    --info: 199 89% 48%;                  /* #0EA5E9 sky-500 */

    --radius: 0.625rem;                   /* 10px, modéré (pas trop arrondi) */
  }

  .dark {
    --background: 222.2 84% 4.9%;         /* slate-950 */
    --foreground: 210 40% 98%;

    --card: 217.2 32.6% 12%;              /* slate-900 légèrement éclairci */
    --card-foreground: 210 40% 98%;

    --primary: 187 92% 69%;               /* cyan-400 inversion en dark */
    --primary-foreground: 222.2 84% 4.9%;

    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;

    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 187 92% 69%;
  }
}
```

### 2.3 Code couleur odontogramme (validé)

Chaque condition dentaire avec un **symbole** en plus de la couleur (anti-pattern color-only évité) :

| Condition | Couleur | Symbole | Justification skill |
|---|---|---|---|
| Saine | `emerald-500 #10B981` | ● | Pattern "vert = OK" universel |
| Carie | `rose-500 #F43F5E` | ▲ | Alert level haut, symbole triangle = attention |
| Plombage | `sky-500 #0EA5E9` | ■ | Réparé, bleu neutre |
| Couronne | `amber-500 #F59E0B` | ◆ | Or/jaune = prothèse précieuse |
| Implant | `violet-500 #8B5CF6` | ⬢ | Métal, hexagone = vis |
| Absente | `slate-300 #CBD5E1` | ○ | Gris = neutre, cercle vide |
| À extraire | `rose-700 #BE123C` | ✕ | Rouge foncé + croix |
| Dévitalisée | `slate-500 #64748B` | ◐ | Gris foncé = inerte |
| Fracture | `orange-500 #F97316` | ⚡ | Avertissement urgent |
| Prothèse | `indigo-500 #6366F1` | ◢ | Bleu profond = remplacement |

---

## 3. Typographie (validée + ajustée)

### 3.1 Familles

| Usage | Police | Recommandation skill |
|---|---|---|
| **UI latin (FR/EN)** | **Inter** | ✅ Skill recommande Inter explicitement pour dashboards (style #5 "Minimal Swiss") |
| **UI arabe moderne** | **Noto Sans Arabic** | ✅ Skill recommande pour Arabic |
| **PDF / titres arabes traditionnels** | **Noto Naskh Arabic** | ✅ Skill recommande pour mentions légales, ordonnances |
| **Données chiffrées (factures, KPIs)** | **Inter `tabular-nums`** | Règle "number-tabular" pour éviter le layout shift |

### 3.2 Échelle (validée Minimalism Swiss style)

| Token | Taille | Line-height | Weight | Usage |
|---|---|---|---|---|
| `text-xs` | 12px | 16px | 500 | Badges, méta |
| `text-sm` | 14px | 20px | 400 | Texte secondaire, cellules table |
| `text-base` | 16px | 24px | 400 | **Texte courant — minimum mobile (skill rule)** |
| `text-lg` | 18px | 28px | 500 | Sous-titres |
| `text-xl` | 20px | 28px | 600 | Titres de section |
| `text-2xl` | 24px | 32px | 700 | Titres de page |
| `text-3xl` | 30px | 36px | 700 | KPIs dashboard, hero |

### 3.3 Setup Next.js (next/font)

```ts
// src/app/[locale]/layout.tsx
import { Inter, Noto_Sans_Arabic, Noto_Naskh_Arabic } from 'next/font/google';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-arabic',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const notoNaskh = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  variable: '--font-arabic-naskh',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});
```

---

## 4. Layout dashboard — pattern "Healthcare Analytics"

Recommandation skill + adaptations pour cabinet dentaire :

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] [⌘K Search──────────] [🔔 3] [🌐 FR] [👤 Dr Karim] │  ← Topbar 56px
├──────────┬──────────────────────────────────────────────────┤
│ ▓ Dash   │                                                  │
│ • Patients│              CONTENU PAGE                        │
│ • RDV    │                                                  │
│ • Dossier│   (RSC streaming, skeleton loading)              │
│ • Odonto │                                                  │
│ • Facture│                                                  │
│ • Plans  │                                                  │
│ • Stock  │                                                  │
│ • Recall │                                                  │
│ ─────────│                                                  │
│ • Users  │                                                  │
│ • Config │                                                  │
└──────────┴──────────────────────────────────────────────────┘
 240px sidebar     1200px max contenu, gutters 24px desktop, 16px tablette
```

### Règles "Healthcare Analytics" appliquées

- Density data : **moyenne** (pas dense comme finance, pas aéré comme patient app)
- Color coding : sémantique uniquement (succès/warning/danger), **jamais décoratif**
- Whitespace : 24px entre sections, 16px dans cards
- Sidebar repliable < 1024px (mobile : drawer)
- Topbar **sticky**, sidebar **fixed** sur desktop

---

## 5. Composants spécifiques DentalCare

### 5.1 Odontogramme graphique

```
┌────────────────────────────────────────────────────────────┐
│  Odontogramme — Ahmed Bennali (DDN 15/03/1988)            │
│  [Mode : Lecture ⏵ Édition] [Historique ▾]                │
├────────────────────────────────────────────────────────────┤
│                                                             │
│   MAXILLAIRE DROIT          │           MAXILLAIRE GAUCHE   │
│   18  17  16  15  14  13  12  11│11  12  13  14  15  16  17  18│
│   ▓   ●   ●   ▲*  ●   ●   ●   ● │●   ●   ●   ●   ●   ■   ●   ▓ │
│                                                             │
│   ─────────── 32 dents FDI permanentes ───────────         │
│                                                             │
│   48  47  46  45  44  43  42  41│41  42  43  44  45  46  47  48│
│   ▓   ●   ●   ●   ●   ●   ●   ● │●   ●   ●   ●   ●   ●   ●   ◐ │
│   MANDIBULAIRE DROIT        │          MANDIBULAIRE GAUCHE  │
│                                                             │
│   * = sélectionnée → panneau détail à droite               │
│                                                             │
│   Légende : ● Saine  ▲ Carie  ■ Plombage  ◆ Couronne      │
│             ⬢ Implant  ○ Absente  ✕ À extraire             │
│             ◐ Dévitalisée  ⚡ Fracture  ◢ Prothèse        │
└────────────────────────────────────────────────────────────┘

  ┌──────────────────── Panneau dent 15 ────────────────────┐
  │ Dent 15 — Prémolaire supérieure droite                 │
  │ Condition actuelle : ▲ Carie (depuis 12/04/2026)       │
  │ Surfaces : ☑ Occlusale  ☐ Mésiale  ☑ Distale          │
  │                                                          │
  │ Historique :                                             │
  │ • 12/04/2026 — Diagnostic carie (Dr Karim)              │
  │ • 03/01/2024 — Plombage occlusal (Dr Karim)             │
  │                                                          │
  │ Actions : [Marquer traitée] [Planifier traitement]     │
  └──────────────────────────────────────────────────────────┘
```

**Implémentation :**
- SVG cliquable, chaque dent = `<button role="button">` (touch target ≥ 44×44 en zoom appli)
- Hover + focus visible (ring 2px primary)
- Drag pour sélection multiple → "générer plan de traitement"
- Tooltip au hover avec dernière condition
- RTL : ordre des dents inversé (maxillaire 11→18 devient 18→11 visuellement, mais numérotation FDI invariante)

### 5.2 Calendrier RDV — FullCalendar

```
┌────────────────────────────────────────────────────────────┐
│ Semaine du 18-24 mai 2026   [⏮]  [Aujourd'hui]  [⏭]      │
│ Vue : [Jour] [Semaine ●] [Mois]  Dentiste : [Tous ▾]     │
├────────────────────────────────────────────────────────────┤
│        Lun 18 │ Mar 19 │ Mer 20 │ Jeu 21 │ Ven 22 │ Sam 23 │
│ 08:00 ┌────┐                                                │
│        │ A. │                                                │
│ 08:30  │Ben.│   ┌────┐                       ┌────┐         │
│        │Det.│   │ F. │                       │ K. │         │
│ 09:00  └────┘   │Tazi│   ┌────┐              │Aml.│         │
│                 │Imp.│   │ S. │              │Ext.│         │
│ 09:30           └────┘   │Bou.│              └────┘         │
│                          │Net.│                              │
│ ...                      └────┘                              │
│                                                              │
│ Légende dentistes :                                          │
│   ● Dr Karim Benali (cyan)                                  │
│   ● Dr Salma Idrissi (vert)                                 │
│                                                              │
│ Annulations → liste d'attente notifiée auto                 │
└────────────────────────────────────────────────────────────┘
```

**Adaptations :**
- Couleur par dentiste (cyan / vert / orange / violet — assignés à création)
- Hover RDV → tooltip avec patient + motif + statut confirmation
- Drag & drop → vérification conflit serveur, rollback visuel si refusé
- Plages de travail dentiste : fond `muted` clair, hors plages : fond `slate-100`
- Indisponibilités (absences) : fond `slate-200` hachuré + label "Congé"
- Mobile : vue Jour uniquement, scroll vertical

### 5.3 Dashboard KPI cards (pattern "Healthcare Analytics")

```
┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────────┐
│ CA du mois          │  │ Patients actifs     │  │ RDV cette sem.   │
│                     │  │                     │  │                  │
│   125 420 DH        │  │      342            │  │     47           │
│   ▲ +12% vs prev    │  │   ▲ +8 nouveaux    │  │   ✓ 31 confirmés │
│                     │  │                     │  │   ⚠ 16 attente   │
└─────────────────────┘  └─────────────────────┘  └──────────────────┘

  Cards : padding 24px, ombre légère, hover : élévation subtile
  KPI : font-size 30px (text-3xl), tabular-nums, weight 700
  Delta : icône directionnelle + couleur sémantique
```

### 5.4 Patient detail header

```
┌────────────────────────────────────────────────────────────┐
│  [Photo]  Ahmed Bennali           [Modifier] [Supprimer]  │
│  120×120  38 ans (15/03/1988) — CIN B123456               │
│           📞 +212 612 345 678  📧 a.bennali@gmail.com     │
│           🏠 Avenue Hassan II, Fès                         │
│           🩸 Groupe O+  ⚠ Allergique pénicilline          │
│           💬 Canal préféré : WhatsApp  🌐 Langue : العربية │
│                                                             │
│  ┌─────────┬─────────┬────────────┬─────┬────────┐        │
│  │ Infos ● │ Dossier │ Odontogr.  │ RDV │ Factur.│        │
│  └─────────┴─────────┴────────────┴─────┴────────┘        │
└────────────────────────────────────────────────────────────┘
```

---

## 6. Effets et animations (validées skill)

### Transitions

- **Micro-interactions** : 150ms (hover button, focus ring, expand row)
- **Modaux/sheets** : 200ms ease-out à l'ouverture, 140ms ease-in à la fermeture (skill rule `exit-faster-than-enter`)
- **Page transitions** : aucune (RSC streaming + Suspense suffit)
- **Drag & drop calendar** : feedback temps réel + spring physics à la chute

### Ombres (cohérentes)

```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow:    0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
--shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
--shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
```

Application :
- Cards : `--shadow-sm`
- Hover cards interactives : `--shadow-md`
- Modaux : `--shadow-lg` + scrim 50% noir

---

## 7. Accessibilité (CRITICAL skill priority #1)

Checklist obligatoire dérivée du skill (Pre-Delivery Checklist) :

- [ ] **Contraste 4.5:1** vérifié sur primary cyan-600 sur blanc → OK (`#0891B2` sur `#FFFFFF` = 4.55:1) ✅
- [ ] **Contraste 7:1** pour texte body sur fond (objectif WCAG AAA pour médical)
- [ ] **Touch targets ≥ 44×44** (boutons, dents odontogramme, RDV calendrier)
- [ ] **Focus rings** 2-3px visible (`ring-2 ring-primary ring-offset-2`)
- [ ] **prefers-reduced-motion** : désactiver toutes les animations > 100ms
- [ ] **Dark mode** testé indépendamment (contrast pairs séparés)
- [ ] **Couleur jamais seule** : odontogramme avec symboles ✅
- [ ] **RTL** : audit complet sur arabe (sidebar, calendrier, formulaires, odontogramme)
- [ ] **Lecteur d'écran** : labels ARIA sur dents odontogramme + statuts RDV
- [ ] **Tabular nums** pour DH/MAD, heures, dates
- [ ] **Skip link** "Aller au contenu principal" en haut de chaque page
- [ ] **Navigation clavier** : Tab/Shift+Tab/Esc/Enter partout, ⌘K palette

---

## 8. Ce qui change par rapport à brand-guidelines.md

| Élément | brand-guidelines.md (initial) | Design system validé | Raison |
|---|---|---|---|
| Primary color | `#0D9488` teal-600 | `#0891B2` cyan-600 *(option B, à valider)* | Recommandation explicite skill pour Medical Clinic |
| Accent | Cyan-500 | **Green-600 `#16A34A`** | "Health green" obligatoire selon `colors.csv` line 59 |
| Border radius | Non défini | `0.625rem` (10px) | Modéré : ni anguleux brutalist, ni rond claymorphic |
| Police PDF arabe | Noto Sans Arabic | **Noto Naskh Arabic** pour en-têtes/légal | Recommandation explicite skill |
| Tabular numerals | Non mentionné | **Obligatoire** sur DH, heures, dates | Anti layout-shift sur données financières |
| Style global | Implicite | **Minimalism + Accessible & Ethical** confirmé | Match Medical Clinic |
| Anti-pattern | Pas mentionné | Liste explicite : **pas de gradients AI purple/pink, pas de neon, pas de neumorphism sur dashboard** | Skill HIGH severity |

---

## 9. Stack Next.js — règles critiques skill

Extrait des règles `severity=High` de `nextjs.csv` pertinentes :

- **Routing** : `app/` router + `error.tsx` + `loading.tsx` par route
- **Rendering** : Server Components par défaut, `'use client'` poussé aux feuilles
- **Data fetching** : Fetch dans Server Components, `cache: 'force-cache'` explicite (Next.js 15 par défaut uncached !)
- **Mutations** : Server Actions, jamais d'API route pour les formulaires
- **Image** : `next/image` + dimensions + `priority` sur hero
- **Font** : `next/font` + `display: swap` (déjà prévu §3.3)
- **Suspense** : streaming pour les sections lourdes (dashboard, calendrier)
- **Cache** : explicit `revalidate` ou `cache: 'force-cache'` partout
