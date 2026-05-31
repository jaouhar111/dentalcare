# Landing page assets

Drop the AI-generated images here with these exact names. The landing
page reads them via Next.js `<Image>` and falls back to animated
mockup tiles when a file is missing — so it never breaks during
development.

| File | Where it shows | Required size | Aspect ratio |
|---|---|---|---|
| `hero-phone.png` | Hero, centred below the headline | 1080 × 1350 | 4:5 vertical |
| `cabinet-interior.jpg` | (Reserved — future "showcase" card) | 1600 × 1000 | 16:10 |
| `doctor-portrait.jpg` | (Reserved — future testimonials) | 1200 × 1500 | 4:5 vertical |
| `og-image.jpg` | Open Graph (Facebook / WhatsApp / X share) | 1200 × 630 | 1.91:1 |

PNG for `hero-phone` so the phone outline cuts cleanly against the
pure white hero background. JPG everywhere else for smaller bundle.

**Optimisation**: run each through https://squoosh.app/ before
committing — keep under 250 KB / file.

---

## Apple-style image prompts (Nano Banana / Midjourney v7 / DALL·E 3)

The landing now follows apple.com vocabulary:

- pure white surface: `#ffffff`
- Apple gray cards: `#f5f5f7`
- pure black story cards: `#000000`
- text: `#1d1d1f` (Apple near-black) / `#6e6e73` (sub copy)
- accent blue: `#0071e3` (filled CTA) / `#0066cc` (link text) / `#2997ff` (on-dark link)

Style anchors: studio product photography, pure white seamless
background, soft architectural shadow, real glass reflections, the
exact look of apple.com hero product shots. **No lifestyle / no
ambient props / no warmth.**

### 1) `hero-phone.png` — 1080 × 1350 (4:5)

> **A studio-grade product shot of a modern iPhone 16 Pro held vertically, dead-centered against a pure white seamless background (#ffffff). The phone is upright with zero rotation, screen facing the camera. The display shows a WhatsApp conversation with the contact "DentalCare": a patient bubble in light gray "Bonjour, j'ai mal à une dent depuis hier soir." followed by a single Apple-blue gradient (#0071e3) reply bubble confirming an appointment. Below the chat, a small floating glass card overlay reads "RDV créé · 12s". The phone casts a very soft, neutral, perfectly grounded shadow directly under it (no warmth, no color tint). Studio softbox lighting with sharp catchlights on the bezel edges, real glass reflections on the screen surface, near-zero specular bloom. Exact apple.com product-page aesthetic — clean, technical, premium. Aspect 4:5 vertical, ample white margin on all sides. Photoreal, 8K, Hasselblad H6D, 100mm macro lens, f/8, ISO 100.**

### 2) `cabinet-interior.jpg` — 1600 × 1000 (16:10)

> **A wide-angle architectural interior photograph of an empty, immaculate modern dental clinic. Pure white walls, polished light concrete floor, a single dental chair in light cream leather centered under a soft pendant light. Natural cool daylight from large floor-to-ceiling windows on the right. No people. No clutter. No branding. No warmth — neutral cool whites with very pale blue shadows (#f5f5f7 in the soft midtones). Inspired by Apple Park interior photography and Kinfolk magazine architecture spreads. Shot on Leica Q, 24mm equivalent, f/5.6, ISO 200. Crisp focus front-to-back. Cinematic 16:10 crop. Composition: rule-of-thirds with the chair on the lower-left intersection.**

### 3) `doctor-portrait.jpg` — 1200 × 1500 (4:5) *(future testimonials)*

> **An editorial environmental portrait of a confident Moroccan dentist in their late 30s, wearing a clean white tunic over a soft gray shirt, standing in front of a textured pure white wall. They are looking directly at the camera with a small genuine smile — relaxed, trustworthy, not posed. Soft directional studio light from the upper-left, creating a gentle Rembrandt triangle on the right cheek. Pure white background, no props, no logos. Apple "About leadership" page aesthetic — minimal, confident, neutral. Shot on Canon R5 with 85mm f/1.4, shallow depth of field, very slight film grain. 4:5 vertical crop, head-and-upper-shoulders framing with room above the head.**

### 4) `og-image.jpg` — 1200 × 630 (1.91:1)

> **A clean Open Graph share card on pure white (#ffffff). Centred composition: the word "DentalCare." in SF Pro Display Semibold, deep near-black (#1d1d1f), set very large — around 140pt — with a smaller second line "Le cabinet, géré tout seul." in #6e6e73 right below. Underneath the type, a 3D-rendered iPhone 16 Pro shown frontally, screen displaying a WhatsApp chat bubble in Apple blue (#0071e3), casting a soft neutral shadow directly under it. A tiny corner mark in the upper-left: a blue tooth icon and the wordmark "DentalCare" in tiny 12pt. The whole composition feels like an apple.com press kit slide — minimal, confident, neutral, no decoration. 1.91:1 horizontal crop, generous whitespace.**

---

## Tips for whichever generator you use

- **Nano Banana / Gemini Image**: paste the prompt as-is. If the phone screen text is wrong, run a follow-up `/edit` pass with "make the chat bubble text say exactly …".
- **Midjourney v7**: append ` --ar 4:5 --style raw --stylize 50` to the hero, ` --ar 16:10 --style raw --stylize 50` to the interior. Use `--no people, text, logos, watermark, warmth, color tint` for the product shots.
- **DALL·E 3 (ChatGPT)**: best for the OG card. For the hero phone screen, ask for "natural realistic UI rendering, no text artifacts, apple.com product-page style".

After generation, run through https://squoosh.app/ (WebP q=82 for JPG, oxipng for PNG) before committing.
