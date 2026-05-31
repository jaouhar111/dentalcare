/**
 * Audio transcription via Gemini 2.0 Flash.
 *
 * Gemini Flash accepts audio inline (base64) with a `generateContent`
 * call, which is much cheaper + faster than going through a dedicated
 * speech-to-text endpoint. It also handles French + Arabic + Darija
 * natively, which is what we need for the Moroccan dental cabinet.
 *
 * We DON'T add a Groq fallback for transcription because Groq Llama
 * doesn't support audio input. If Gemini fails or is rate-limited the
 * webhook handler degrades gracefully — sends back "désolé, je n'ai
 * pas compris ton vocal, peux-tu réécrire ?".
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/lib/env";

/// `flash-lite` is text-only — for audio we need the multimodal alias.
/// `gemini-flash-latest` accepts WAV/MP3/AAC/OGG/FLAC inline and runs
/// on the same free quota tier.
const MODEL = "gemini-flash-latest";
const TIMEOUT_MS = 20_000;

/**
 * Returns the transcript of an audio buffer, or `null` if the call
 * failed for any reason. We swallow errors here because the webhook
 * caller has its own fallback path; logging happens via the audit
 * log inside the caller.
 */
export async function transcribeAudio(args: {
  buffer: Buffer;
  mimeType: string;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (!env.GEMINI_API_KEY) {
    return { ok: false, error: "GEMINI_API_KEY missing" };
  }
  const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = client.getGenerativeModel({ model: MODEL });

  const inlineData = {
    mimeType: args.mimeType,
    data: args.buffer.toString("base64"),
  };

  const prompt =
    "Transcris ce message vocal en texte brut. " +
    "Conserve la langue d'origine (français, arabe classique, darija marocaine ou anglais). " +
    "N'ajoute AUCUN commentaire, AUCUNE traduction, AUCUNE ponctuation décorative. " +
    "Si le vocal est inaudible ou vide, réponds exactement: <INAUDIBLE>.";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, { inlineData }],
        },
      ],
      generationConfig: { temperature: 0.0, maxOutputTokens: 512 },
    });
    clearTimeout(timer);
    const text = res.response.text().trim();
    if (!text || text === "<INAUDIBLE>") {
      return { ok: false, error: "INAUDIBLE" };
    }
    return { ok: true, text };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
