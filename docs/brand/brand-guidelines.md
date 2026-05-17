# Identité visuelle DentalCare

> Q8 résolu — Palette, typographie, logo. Modifiable : si une teinte ou le logo ne plaît pas, dites lequel changer.

## 1. Palette de couleurs

Choix d'une **teinte teal** (sarcelle) comme couleur primaire : associée au médical/clinique, calme, moderne, peu utilisée par la concurrence dentaire qui penche surtout vers le bleu marine.

### Couleurs sémantiques

| Rôle | Tailwind | Hex | OKLCH | Usage |
|---|---|---|---|---|
| **Primary** | `teal-600` | `#0D9488` | `oklch(0.60 0.11 184)` | Boutons principaux, liens actifs, logo |
| **Primary dark** | `teal-800` | `#115E59` | `oklch(0.43 0.07 184)` | Hover, texte logo, headers |
| **Primary light** | `teal-50` | `#F0FDFA` | `oklch(0.98 0.02 184)` | Backgrounds doux, badges info |
| **Accent** | `cyan-500` | `#06B6D4` | `oklch(0.70 0.14 213)` | Highlights, graphes Recharts |
| **Background** | `slate-50` | `#F8FAFC` | — | Fond app |
| **Surface** | `white` | `#FFFFFF` | — | Cards, modals |
| **Text primary** | `slate-900` | `#0F172A` | — | Texte principal |
| **Text muted** | `slate-500` | `#64748B` | — | Sous-titres, méta |
| **Border** | `slate-200` | `#E2E8F0` | — | Séparateurs |

### Couleurs d'état

| Rôle | Tailwind | Hex | Usage |
|---|---|---|---|
| **Success** | `emerald-600` | `#059669` | Payé, confirmé, terminé |
| **Warning** | `amber-500` | `#F59E0B` | Stock bas, expiration proche, en retard léger |
| **Danger** | `rose-600` | `#E11D48` | Annulation, sous seuil critique, factures impayées tardives |
| **Info** | `sky-500` | `#0EA5E9` | Notifications neutres |

### Odontogramme — code couleur par condition

| Condition | Tailwind | Hex |
|---|---|---|
| Saine | `emerald-500` | `#10B981` |
| Carie | `rose-500` | `#F43F5E` |
| Plombage | `sky-500` | `#0EA5E9` |
| Couronne | `amber-500` | `#F59E0B` |
| Implant | `violet-500` | `#8B5CF6` |
| Absente | `slate-300` | `#CBD5E1` |
| À extraire | `rose-700` | `#BE123C` |
| Dévitalisée | `slate-500` | `#64748B` |
| Fracture | `orange-500` | `#F97316` |
| Prothèse | `indigo-500` | `#6366F1` |

### Dark mode (auto via `dark:`)

- Background : `slate-950` (`#020617`)
- Surface : `slate-900` (`#0F172A`)
- Text : `slate-50`
- Primary inversion : `teal-400` (`#2DD4BF`) au lieu de `teal-600`

## 2. Typographie

### Familles

| Usage | Police | Fallback | Note |
|---|---|---|---|
| **UI principal (latin)** | Inter | system-ui, sans-serif | Variable font, supports OpenType |
| **UI arabe** | Noto Sans Arabic | Tahoma | Google Fonts, équilibre Inter |
| **Mono (codes, n° facture)** | JetBrains Mono | ui-monospace | Optionnel |

### Échelle typographique (Tailwind)

| Token | Taille | Line-height | Usage |
|---|---|---|---|
| `text-xs` | 12px | 16px | Légendes, méta |
| `text-sm` | 14px | 20px | Texte secondaire, table cells |
| `text-base` | 16px | 24px | Texte courant |
| `text-lg` | 18px | 28px | Sous-titres |
| `text-xl` | 20px | 28px | Titres de section |
| `text-2xl` | 24px | 32px | Titres de page |
| `text-3xl` | 30px | 36px | Hero / dashboard KPIs |

### Poids

- 400 (regular) — texte courant
- 500 (medium) — boutons, labels
- 600 (semibold) — sous-titres
- 700 (bold) — titres, wordmark

### Import (Next.js `next/font`)

```ts
// src/app/[locale]/layout.tsx
import { Inter, Noto_Sans_Arabic } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const notoArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-arabic',
  weight: ['400', '500', '700'],
});
```

Application :
```html
<html className={`${inter.variable} ${notoArabic.variable}`}>
```

CSS :
```css
:root {
  --font-default: var(--font-sans), system-ui, sans-serif;
}
:lang(ar) {
  --font-default: var(--font-arabic), var(--font-sans), system-ui, sans-serif;
}
body { font-family: var(--font-default); }
```

## 3. Logo

Trois variantes fournies dans `docs/brand/` :

| Fichier | Usage |
|---|---|
| `logo-mark.svg` | Icône seule 64×64 — favicon, avatar, app icon |
| `logo.svg` | Icône + wordmark — topbar, PDF en-tête, écran login |
| `logo-dark.svg` | Version inversée pour fond sombre |

### Concept

- **Forme tooth** stylisée, géométrique (pas figurative médicale)
- **Couleur primaire** `teal-600`
- **Wordmark** : `DentalCare` en Inter Bold 700, `teal-800`
- **Tracking** : `-0.02em` pour rapprocher les lettres

### Règles d'usage

- **Zone de sécurité** : minimum 50% de la hauteur de l'icône tout autour
- **Taille minimale** :
  - Icône seule : 24×24 px (favicon, sidebar collapsée)
  - Logo complet : largeur 120 px minimum
- **Ne pas** : déformer, recolorer en dehors de la palette, ajouter d'effets (ombres, gradients non prévus)
- **Sur photo** : utiliser `logo-dark.svg` blanc, ou ajouter un fond solide derrière

### Favicon

Générer depuis `logo-mark.svg` :
- `favicon.ico` (32×32)
- `apple-touch-icon.png` (180×180) avec fond `teal-600`
- `icon.svg` direct dans `app/icon.svg` (Next.js auto)

## 4. Iconographie

- **Bibliothèque** : `lucide-react` (déjà utilisée par shadcn/ui)
- **Style** : stroke 1.5, coins arrondis
- **Taille par défaut** : 20 px (`size-5` Tailwind)
- Icônes métier dentaire spécifiques :
  - Aucune lib dédiée → utiliser emojis 🦷 dans messages WhatsApp
  - Pour UI app : construire des SVG custom si besoin (radio, prescription, etc.)

## 5. Tailwind config (extrait)

```ts
// tailwind.config.ts — extrait à intégrer en T0.1
import type { Config } from 'tailwindcss';

export default {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          500: '#14B8A6',
          600: '#0D9488', // primary
          700: '#0F766E',
          800: '#115E59', // dark
          900: '#134E4A',
        },
      },
      fontFamily: {
        sans: ['var(--font-default)'],
        mono: ['var(--font-mono)', 'ui-monospace'],
      },
    },
  },
} satisfies Config;
```

shadcn/ui — variables CSS (`globals.css`) :
```css
@layer base {
  :root {
    --primary: 174 84% 32%;        /* teal-600 */
    --primary-foreground: 0 0% 100%;
    --ring: 174 84% 32%;
    /* … garder les valeurs shadcn par défaut pour le reste */
  }
}
```

## 6. Application au PDF (factures / ordonnances)

- En-tête : `logo.svg` à 40 px de haut, aligné à gauche
- Couleur primaire pour bordures de section
- Texte noir sur blanc (lisibilité impression)
- En arabe : police Noto Sans Arabic, alignement à droite, mentions légales bilingues FR+AR ou EN+AR

## 7. Notes pour la suite

- **À faire** : si une couleur ou le logo ne convient pas, indiquer laquelle remplacer (vous pouvez fournir une couleur de marque existante).
- **À fournir éventuellement** : nom alternatif du cabinet (le wordmark "DentalCare" est un nom produit générique — si vous avez un nom commercial spécifique pour le cabinet, on l'utilise à la place).
