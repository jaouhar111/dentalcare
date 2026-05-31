/**
 * Text-to-speech via Gemini 2.5 Flash TTS preview, encoded to MP3.
 *
 * Used by the WhatsApp webhook to reply with a voice note when the
 * patient sent one — keeps the conversation in the modality the
 * patient chose. If TTS fails, the caller falls back to plain text
 * `sendText` so the patient is never left without an answer.
 *
 * Pipeline: Gemini returns raw PCM s16le 24 kHz mono → we encode it
 * to MP3 (CBR 64 kbps mono, plenty for speech) via `lamejs`, a pure
 * JS encoder so we don't need ffmpeg on the host.
 * Output mimeType: `audio/mpeg` — one of the formats Meta's voice
 * endpoint accepts. WAV is REJECTED by Meta, hence the conversion.
 *
 * Why not Groq fallback: Groq has no TTS endpoint. If Gemini TTS is
 * unavailable we degrade to text.
 */

import { env } from "@/lib/env";

// Lazy-load lamejs — the package is ESM-only and a static top-level
// `import { Mp3Encoder } from "@breezystack/lamejs"` breaks under tsx's
// CJS interop. Dynamic import inside the helper sidesteps that and
// keeps Next.js's static analysis happy.
async function getMp3Encoder() {
  const mod = await import("@breezystack/lamejs");
  return mod.Mp3Encoder;
}

/// `gemini-2.5-flash-preview-tts` is the dedicated TTS variant — it
/// only takes text input and only emits audio. The "preview" suffix
/// will change as it goes GA; check the AI Studio model list if calls
/// start returning 404.
const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const TIMEOUT_MS = 15_000;

/// Voice presets shipped by Gemini — `Kore` is a warm female French
/// voice that fits a clinical assistant. Full list at
/// https://ai.google.dev/gemini-api/docs/speech-generation
const DEFAULT_VOICE = "Kore";

export async function synthesizeSpeech(args: {
  text: string;
  voice?: string;
}): Promise<{ ok: true; buffer: Buffer; mimeType: string } | { ok: false; error: string }> {
  if (!env.GEMINI_API_KEY) {
    return { ok: false, error: "GEMINI_API_KEY missing" };
  }
  // We hit the REST endpoint directly because the SDK's TS types for
  // `responseModalities` still trail the preview. A direct fetch keeps
  // the surface minimal + lets us adapt as the API stabilises.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: args.text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: args.voice ?? DEFAULT_VOICE } },
      },
    },
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const json = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { data: string; mimeType: string };
          }>;
        };
      }>;
      error?: { message: string };
    };
    if (!res.ok || json.error) {
      return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
    }
    const inline = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (!inline) {
      return { ok: false, error: "no inline audio in response" };
    }
    // Gemini emits raw PCM s16le (signed 16-bit, little-endian) at
    // 24 kHz mono. Encode it to MP3 because Meta REJECTS WAV at the
    // /media upload step (`Param file must be one of audio/aac,
    // audio/mp4, audio/mpeg, audio/amr, audio/ogg, audio/opus`).
    const pcm = Buffer.from(inline.data, "base64");
    const mp3 = await pcmToMp3(pcm, { sampleRate: 24_000, channels: 1 });
    return { ok: true, buffer: mp3, mimeType: "audio/mpeg" };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Encodes a raw PCM s16le buffer (mono or stereo, any sample rate)
 * to an MP3 byte stream via lamejs. Pure JS, no native deps — runs
 * on Vercel Edge / Node alike. Bitrate 64 kbps mono is plenty for
 * speech (≈ 8 KB per second).
 */
async function pcmToMp3(
  pcm: Buffer,
  opts: { sampleRate: number; channels: number },
): Promise<Buffer> {
  const Mp3Encoder = await getMp3Encoder();
  const encoder = new Mp3Encoder(opts.channels, opts.sampleRate, 64);
  // PCM s16le → Int16Array view over the same memory.
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length / 2);
  const blockSize = 1152; // lame internal frame size for granule alignment
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < samples.length; i += blockSize) {
    const slice = samples.subarray(i, i + blockSize);
    const enc = encoder.encodeBuffer(slice);
    if (enc.length > 0) chunks.push(enc);
  }
  const flush = encoder.flush();
  if (flush.length > 0) chunks.push(flush);
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = Buffer.alloc(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
