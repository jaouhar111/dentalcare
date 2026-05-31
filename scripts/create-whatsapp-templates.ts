/**
 * Creates the production WhatsApp templates on the WABA via the Meta Graph API.
 *
 * Manual creation through Meta UI is brittle (one wrong category, one
 * missing example, the form silently saves a draft) — driving it from
 * code keeps the bodies in lockstep with `src/lib/whatsapp/templates.ts`.
 *
 * Idempotent: if a template with the same name+language already exists,
 * Meta returns a "template already exists" error which we surface as
 * `(exists)` instead of failing the run.
 *
 * Each submission is initially `PENDING` for Meta review. Utility
 * templates typically go APPROVED within a few minutes.
 *
 * Run: pnpm tsx scripts/create-whatsapp-templates.ts
 */
import "dotenv/config";

const META = "https://graph.facebook.com/v21.0";

interface TemplateSpec {
  name: string;
  language: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  components: unknown[];
}

const TEMPLATES: TemplateSpec[] = [
  {
    name: "appointment_reminder",
    language: "fr",
    category: "UTILITY",
    components: [
      { type: "HEADER", format: "TEXT", text: "Rappel de rendez-vous" },
      {
        type: "BODY",
        text:
          "Bonjour {{1}} 👋\n\n" +
          "Nous vous rappelons votre rendez-vous au cabinet {{5}} :\n\n" +
          "📅 {{2}} à {{3}}\n" +
          "👩‍⚕️ {{4}}\n\n" +
          "Merci de confirmer votre présence ou de demander un report.",
        example: {
          body_text: [
            ["Mehdi", "vendredi 30 mai", "14h30", "Dr Otmane Hdoud", "Cabinet Hdoud Otmane"],
          ],
        },
      },
      { type: "FOOTER", text: "Cabinet Hdoud Otmane — Merci de votre confiance" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Je confirme" },
          { type: "QUICK_REPLY", text: "Demander à reporter" },
        ],
      },
    ],
  },
  {
    name: "checkup_reminder",
    language: "fr",
    category: "UTILITY",
    components: [
      { type: "HEADER", format: "TEXT", text: "Il est temps de prendre soin de votre sourire" },
      {
        type: "BODY",
        text:
          "Bonjour {{1}}\n\n" +
          "Cela fait {{3}} depuis votre dernier {{2}}. Pour maintenir votre santé bucco-dentaire, nous vous recommandons de prendre rendez-vous.\n\n" +
          "Le cabinet {{4}} reste à votre disposition au {{5}} pour vous accueillir.",
        example: {
          body_text: [
            [
              "Mehdi",
              "détartrage",
              "6 mois",
              "Cabinet Hdoud Otmane",
              "+212522000000",
            ],
          ],
        },
      },
      { type: "FOOTER", text: "À très bientôt" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Prendre rendez-vous" },
          { type: "QUICK_REPLY", text: "Me rappeler plus tard" },
        ],
      },
    ],
  },
];

async function main() {
  const token = process.env.WHATSAPP_TOKEN;
  const wabaId = process.env.WHATSAPP_BUSINESS_ID;
  if (!token || !wabaId) {
    console.error("Missing WHATSAPP_TOKEN or WHATSAPP_BUSINESS_ID");
    process.exit(1);
  }

  for (const tpl of TEMPLATES) {
    process.stdout.write(`  ${tpl.name} (${tpl.language}) … `);
    const res = await fetch(`${META}/${wabaId}/message_templates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tpl),
    });
    const json = (await res.json()) as {
      id?: string;
      status?: string;
      category?: string;
      error?: { message: string; code: number; error_subcode?: number };
    };
    if (json.error) {
      const msg = json.error.message;
      // Meta returns 2388023 / 2388024 when the (name, language) pair
      // already has content — treat both as "already there, skip".
      if (
        msg.includes("already exists") ||
        msg.includes("existe déjà") ||
        json.error.error_subcode === 2388023 ||
        json.error.error_subcode === 2388024
      ) {
        console.log("(exists)");
      } else {
        console.log(`❌ ${msg}`);
        console.log(`   detail: ${JSON.stringify(json.error)}`);
      }
      continue;
    }
    console.log(`✅ id=${json.id} status=${json.status}`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
