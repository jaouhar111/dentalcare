import { z } from "zod";

/**
 * Zod-validated environment variables.
 *
 * Crashes the process at boot if a required variable is missing or invalid,
 * preventing silent runtime failures. Never reference `process.env.X` directly
 * in app code — import `env` from this module instead.
 */
const envSchema = z.object({
  // Database (Neon)
  DATABASE_URL: z.string().url().startsWith("postgres"),
  DIRECT_URL: z.string().url().startsWith("postgres"),

  // Auth.js v5
  AUTH_SECRET: z.string().min(32),
  AUTH_TRUST_HOST: z.string().optional(),

  // WhatsApp Cloud API (optional in dev — falls back to console logging)
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_ID: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),

  // Cron secret protects /api/cron/* endpoints
  CRON_SECRET: z.string().optional(),

  // Cloudinary — radiographs + treatment photos (Phase 5). Optional in dev:
  // when blank, uploads fall back to public/_uploads and inline URLs.
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Public URL used for outbound links (reset email, WhatsApp button URLs).
  // Optional in dev (falls back to http://localhost:3000).
  NEXTAUTH_URL: z.string().url().optional(),

  // --- Phase 13: production-ready ---

  // Resend (transactional email). Optional in dev — falls back to console.log.
  // Get a key at https://resend.com/api-keys, then verify your sender domain
  // (or use the `onboarding@resend.dev` sandbox sender for early tests).
  RESEND_API_KEY: z.string().optional(),
  // Sender address shown to recipients. Must be a verified domain in prod.
  RESEND_FROM_EMAIL: z.string().email().optional(),
  // Friendly "From" name (e.g. "Cabinet Dr Benali"). Falls back to clinic name.
  RESEND_FROM_NAME: z.string().optional(),

  // Sentry — error monitoring. Optional in dev (no-op when blank).
  // Set NEXT_PUBLIC_SENTRY_DSN in .env so it's bundled for the browser too.
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  // Required only at build time for source-map upload to Sentry.
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // Upstash Redis — distributed rate limiting + caching.
  // Optional in dev: rate limiter falls back to in-memory (per-process).
  // Required in prod when running on Vercel (serverless = no shared memory).
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // --- AI-0: AI provider cascade + event orchestrator ---

  // Google Gemini (primary AI provider — free tier 1500 req/day).
  // Get a key at https://aistudio.google.com/app/apikey.
  GEMINI_API_KEY: z.string().optional(),
  // Override the model — leave empty to use the cascade default.
  GEMINI_MODEL: z.string().optional(),

  // Groq (fallback when Gemini hits its 429). Free tier with rate limits.
  // Get a key at https://console.groq.com/keys.
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().optional(),

  // Inngest event orchestrator. Replaces Vercel cron with an event-driven
  // pipeline (retry + visual debug). In dev you can run `npx inngest-cli
  // dev` to get a local dashboard; the `signingKey` is then optional.
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  // Node / runtime
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`\n❌ Invalid environment variables. Check your .env file:\n${issues}\n`);
  }
  return parsed.data;
}

export const env: Env = loadEnv();
