# Templates WhatsApp Cloud API (Meta)

> Q7 résolu — 4 templates × 3 langues = **12 templates** à soumettre à Meta Business Manager pour pré-approbation avant la Phase 4.
>
> Toutes les soumissions en **catégorie `UTILITY`** (transactionnel) — pas marketing, pas authentification.

## Sommaire des templates

| Nom (snake_case) | Usage | Variables | Boutons |
|---|---|---|---|
| `appointment_reminder` | Rappel RDV J-1 | 5 | 2 quick reply |
| `waitlist_slot_offered` | Créneau libéré proposé | 6 | 2 quick reply |
| `checkup_reminder` | Recall détartrage / contrôle | 5 | 1 URL + 1 quick reply |
| `payment_due` | Échéance plan de paiement | 6 | 1 URL + 1 quick reply |

## Variables réutilisées (convention)

| Convention | Type | Exemple |
|---|---|---|
| `{{1}}` | Prénom patient | `Ahmed` |
| `{{2}}` | Date formatée locale | `lundi 18 mai 2026` / `Monday, May 18, 2026` / `الإثنين 18 ماي 2026` |
| `{{3}}` | Heure 24h | `14:30` |
| `{{4}}` | Nom complet dentiste | `Dr Karim Benali` |
| `{{5}}` | Nom du cabinet | `DentalCare Fès` |

> Les variables au-delà du 5 sont spécifiques au template (montant, durée, etc.) — détaillées par template.

---

## 1. `appointment_reminder` — Rappel J-1

**Catégorie :** UTILITY
**Variables :** 5 (prénom, date, heure, dentiste, cabinet)
**Boutons :** 2 Quick Reply
- `confirm_attendance` (payload reçu via webhook)
- `request_reschedule`

### 🇫🇷 Français (`fr`)

```
HEADER (text)
Rappel de rendez-vous

BODY
Bonjour {{1}} 👋

Nous vous rappelons votre rendez-vous au cabinet {{5}} :

📅 {{2}} à {{3}}
👩‍⚕️ {{4}}

Merci de confirmer votre présence ou de demander un report.

FOOTER
{{5}} — Merci de votre confiance

BUTTONS
[✅ Je confirme]   [📅 Demander à reporter]
```

### 🇬🇧 English (`en`)

```
HEADER (text)
Appointment reminder

BODY
Hello {{1}} 👋

This is a reminder of your appointment at {{5}}:

📅 {{2}} at {{3}}
👩‍⚕️ {{4}}

Please confirm your attendance or request a reschedule.

FOOTER
{{5}} — Thank you for your trust

BUTTONS
[✅ Confirm]   [📅 Request reschedule]
```

### 🇲🇦 العربية (`ar`)

```
HEADER (text)
تذكير بموعدكم

BODY
مرحبًا {{1}} 👋

نذكركم بموعدكم في عيادة {{5}}:

📅 {{2}} على الساعة {{3}}
👩‍⚕️ {{4}}

يُرجى تأكيد حضوركم أو طلب تأجيل الموعد.

FOOTER
{{5}} — شكرًا لثقتكم

BUTTONS
[✅ أؤكد الحضور]   [📅 طلب تأجيل]
```

---

## 2. `waitlist_slot_offered` — Créneau libéré

**Catégorie :** UTILITY
**Variables :** 6 (prénom, date, heure, dentiste, cabinet, expiration)
**Boutons :** 2 Quick Reply
- `accept_waitlist_slot`
- `decline_waitlist_slot`

> **Note métier :** Premier qui clique gagne (verrou serveur). L'offre expire à `{{6}}` (typiquement 15 minutes).

### 🇫🇷 Français (`fr`)

```
HEADER (text)
✨ Un créneau s'est libéré

BODY
Bonjour {{1}} 👋

Bonne nouvelle ! Un créneau s'est libéré pour vous chez {{5}} :

📅 {{2}} à {{3}}
👩‍⚕️ {{4}}

⏰ Cette proposition expire dans {{6}}. Premier confirmé, premier servi !

FOOTER
{{5}}

BUTTONS
[✅ J'accepte]   [❌ Pas disponible]
```

### 🇬🇧 English (`en`)

```
HEADER (text)
✨ A slot just opened

BODY
Hello {{1}} 👋

Good news! A slot has just opened for you at {{5}}:

📅 {{2}} at {{3}}
👩‍⚕️ {{4}}

⏰ This offer expires in {{6}}. First to confirm gets the slot!

FOOTER
{{5}}

BUTTONS
[✅ I accept]   [❌ Not available]
```

### 🇲🇦 العربية (`ar`)

```
HEADER (text)
✨ توفّر موعد جديد

BODY
مرحبًا {{1}} 👋

خبر سار! توفّر موعد لكم في عيادة {{5}}:

📅 {{2}} على الساعة {{3}}
👩‍⚕️ {{4}}

⏰ ينتهي هذا العرض خلال {{6}}. الأسبق في التأكيد يحظى بالموعد!

FOOTER
{{5}}

BUTTONS
[✅ أوافق]   [❌ غير متاح]
```

---

## 3. `checkup_reminder` — Recall détartrage / contrôle

**Catégorie :** UTILITY
**Variables :** 5
- `{{1}}` Prénom patient
- `{{2}}` Type de contrôle (`contrôle annuel` / `détartrage` / `suivi orthodontie`)
- `{{3}}` Durée depuis dernier (ex. `6 mois`)
- `{{4}}` Nom du cabinet
- `{{5}}` Téléphone du cabinet (E.164)

**Boutons :**
- URL dynamique : `https://app.dentalcare.ma/book?p={{patientToken}}` (variable d'URL Meta)
- Quick Reply : `remind_later` (re-programme à J+30)

### 🇫🇷 Français (`fr`)

```
HEADER (text)
🦷 Il est temps de prendre soin de votre sourire

BODY
Bonjour {{1}} 👋

Cela fait {{3}} depuis votre dernier {{2}}. Pour maintenir votre santé bucco-dentaire, nous vous recommandons de prendre rendez-vous.

{{4}} reste à votre disposition au {{5}} ou via le lien ci-dessous.

FOOTER
À très bientôt — {{4}}

BUTTONS
[📅 Prendre rendez-vous] (URL)
[⏰ Me rappeler plus tard]
```

### 🇬🇧 English (`en`)

```
HEADER (text)
🦷 Time to take care of your smile

BODY
Hello {{1}} 👋

It has been {{3}} since your last {{2}}. To maintain good oral health, we recommend booking an appointment.

{{4}} is available at {{5}} or via the link below.

FOOTER
See you soon — {{4}}

BUTTONS
[📅 Book appointment] (URL)
[⏰ Remind me later]
```

### 🇲🇦 العربية (`ar`)

```
HEADER (text)
🦷 حان وقت العناية بابتسامتكم

BODY
مرحبًا {{1}} 👋

مرّ {{3}} على آخر {{2}}. للحفاظ على صحة فمكم وأسنانكم، ننصحكم بحجز موعد.

عيادة {{4}} في خدمتكم على الرقم {{5}} أو عبر الرابط أسفله.

FOOTER
إلى اللقاء قريبًا — {{4}}

BUTTONS
[📅 حجز موعد] (URL)
[⏰ ذكّروني لاحقًا]
```

---

## 4. `payment_due` — Échéance plan de paiement

**Catégorie :** UTILITY
**Variables :** 6
- `{{1}}` Prénom patient
- `{{2}}` Montant formaté (ex. `1 500,00 DH` / `MAD 1,500.00` / `1 500,00 درهم`)
- `{{3}}` Date d'échéance
- `{{4}}` Numéro d'échéance et total (ex. `2 sur 6`)
- `{{5}}` Numéro de facture (ex. `F-2026-7842`)
- `{{6}}` Nom du cabinet

**Boutons :**
- URL : voir détail facture / plan (token signé)
- Quick Reply : `mark_paid_acknowledged` (marque "réglé en attente de vérification" côté admin)

### 🇫🇷 Français (`fr`)

```
HEADER (text)
💳 Échéance de paiement à venir

BODY
Bonjour {{1}} 👋

Une échéance de votre plan de paiement arrive bientôt :

💰 Montant : {{2}}
📅 Échéance : {{3}}
🔢 Échéance {{4}}
📄 Facture : {{5}}

Pour tout règlement ou question, contactez {{6}}.

FOOTER
{{6}}

BUTTONS
[📄 Voir le détail] (URL)
[✅ Déjà réglé]
```

### 🇬🇧 English (`en`)

```
HEADER (text)
💳 Upcoming payment due

BODY
Hello {{1}} 👋

An installment of your payment plan is coming up:

💰 Amount: {{2}}
📅 Due date: {{3}}
🔢 Installment {{4}}
📄 Invoice: {{5}}

For payment or any question, please contact {{6}}.

FOOTER
{{6}}

BUTTONS
[📄 View details] (URL)
[✅ Already paid]
```

### 🇲🇦 العربية (`ar`)

```
HEADER (text)
💳 قسط مستحق قريبًا

BODY
مرحبًا {{1}} 👋

اقترب موعد قسط من خطة الأداء:

💰 المبلغ: {{2}}
📅 تاريخ الاستحقاق: {{3}}
🔢 القسط {{4}}
📄 الفاتورة: {{5}}

لأي أداء أو استفسار، يُرجى التواصل مع عيادة {{6}}.

FOOTER
{{6}}

BUTTONS
[📄 عرض التفاصيل] (URL)
[✅ تم الأداء]
```

---

## Procédure de soumission Meta

1. Aller sur **Meta Business Manager** → WhatsApp Manager → Templates de message → **Créer un template**
2. Pour chaque template (4 noms × 3 langues = 12 soumissions) :
   - Catégorie : **Utility**
   - Nom : exactement le `snake_case` ci-dessus (`appointment_reminder`, `waitlist_slot_offered`, etc.)
   - Langue : `fr`, `en` ou `ar`
   - Coller Header / Body / Footer / Buttons
   - Ajouter un **exemple de variable** pour chaque `{{n}}` (Meta refuse sans exemple)
3. Soumettre. Délai d'approbation Meta : **24h en moyenne, jusqu'à 72h**.
4. Statut suivi dans WhatsApp Manager (Approuvé / En attente / Rejeté avec motif).

## En cas de rejet Meta

Motifs fréquents :
- **Trop promotionnel** → reformuler en factuel (pas de "Profitez de", "Offre exclusive")
- **Variables non remplies dans l'exemple**
- **Boutons non conformes** (texte trop long, emojis interdits dans certaines régions)
- **Catégorie incorrecte** : si rejeté en Utility, Meta propose souvent Marketing → ne pas accepter, reformuler

## Mapping côté code

Côté backend (`src/lib/whatsapp/templates.ts`), structure suggérée :

```ts
export const TEMPLATES = {
  appointment_reminder: {
    name: 'appointment_reminder',
    languages: ['fr', 'en', 'ar'] as const,
    params: ['patientFirstName', 'date', 'time', 'dentistName', 'clinicName'] as const,
    buttons: {
      confirm: { payload: 'confirm_attendance' },
      reschedule: { payload: 'request_reschedule' },
    },
  },
  // … 3 autres
} as const;
```

## Tests d'envoi avant production

Avant le go-live :
1. Approbation Meta obtenue pour les 12 templates (statut "Approved")
2. Test d'envoi vers un numéro test (le vôtre) en français — vérifier rendu boutons
3. Test en arabe — vérifier RTL natif WhatsApp + emojis
4. Test webhook réception bouton — payload reçu côté serveur
5. Test variables avec contenu spécial (prénom avec apostrophe, dentiste avec accent, etc.)

## Variables d'environnement requises

```
WHATSAPP_TOKEN=…          # System User Token Meta Business
WHATSAPP_PHONE_ID=…       # Phone Number ID (pas le numéro)
WHATSAPP_BUSINESS_ID=…    # WhatsApp Business Account ID
WHATSAPP_VERIFY_TOKEN=…   # Token aléatoire pour validation webhook
WHATSAPP_APP_SECRET=…     # App secret pour vérification HMAC webhook
```
