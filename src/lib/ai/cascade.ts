/**
 * AICascadeProvider — orchestrates Gemini → Groq fallover.
 *
 * Behaviour:
 *  - First request goes to Gemini (1500 free req/day).
 *  - On `ProviderFailoverError` with cause `rate_limit | timeout | server`,
 *    we retry the SAME request on Groq.
 *  - On `unauthorized` or `unknown`, we DON'T fail over — those are bugs
 *    on our side (bad API key, malformed tool definition) and should
 *    surface loudly.
 *  - If both providers fail, we throw the LAST error.
 *
 * The cascade lazily instantiates providers — building one requires its
 * API key to be set, so a dev with only Gemini configured can still use
 * the cascade. When neither is configured the cascade throws a clear
 * error at `chat()` time.
 *
 * Single-source-of-truth singleton: `import { aiCascade } from
 * "@/lib/ai/cascade"`. Don't `new AICascadeProvider()` from callsites;
 * each new instance would re-init the SDK clients.
 */

import { env } from "@/lib/env";
import type { AIProvider, ChatRequest, ChatResponse } from "./types";
import { ProviderFailoverError } from "./types";
import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";

const FAILOVER_CAUSES = new Set(["rate_limit", "timeout", "server"]);

export class AICascadeProvider implements AIProvider {
  readonly name = "gemini" as const; // matches the leg we prefer
  private geminiSingleton: GeminiProvider | null = null;
  private groqSingleton: GroqProvider | null = null;

  private get gemini(): GeminiProvider | null {
    if (!env.GEMINI_API_KEY) return null;
    if (!this.geminiSingleton) this.geminiSingleton = new GeminiProvider();
    return this.geminiSingleton;
  }

  private get groq(): GroqProvider | null {
    if (!env.GROQ_API_KEY) return null;
    if (!this.groqSingleton) this.groqSingleton = new GroqProvider();
    return this.groqSingleton;
  }

  /** True when at least one leg is configured. Use this to gate AI
   *  features in the UI ("Booking via WhatsApp" toggle, etc.) */
  get isConfigured(): boolean {
    return Boolean(env.GEMINI_API_KEY || env.GROQ_API_KEY);
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    if (!this.isConfigured) {
      throw new Error(
        "No AI provider configured — set GEMINI_API_KEY or GROQ_API_KEY in your .env",
      );
    }

    // Try Gemini first if available.
    if (this.gemini) {
      try {
        return await this.gemini.chat(req);
      } catch (err) {
        if (
          err instanceof ProviderFailoverError &&
          FAILOVER_CAUSES.has(err.cause) &&
          this.groq
        ) {
          // eslint-disable-next-line no-console
          console.warn(
            `[ai/cascade] Gemini failed (${err.cause}) — falling over to Groq. ${err.message}`,
          );
          return await this.groq.chat(req);
        }
        // Re-throw unauthorized/unknown OR rethrow when no Groq fallback.
        throw err;
      }
    }

    // No Gemini configured but Groq is — use Groq directly.
    if (this.groq) {
      return await this.groq.chat(req);
    }

    // Defensive: isConfigured above guards this; we can't get here unless
    // env mutated mid-call.
    throw new Error("No AI provider available after cascade resolution");
  }
}

export const aiCascade = new AICascadeProvider();
