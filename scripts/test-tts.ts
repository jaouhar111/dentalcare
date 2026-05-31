/**
 * Sanity check for Gemini TTS — generates a WAV from a short French
 * sentence and writes it to a temp file so we can audit it locally.
 */
import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { synthesizeSpeech } from "@/lib/ai/synthesize";

async function main() {
  const text = "Bonjour. Votre rendez-vous est confirmé pour vendredi à dix heures. À bientôt.";
  console.log(`📣 Synthesising: ${text}`);
  const r = await synthesizeSpeech({ text });
  if (!r.ok) {
    console.error(`❌ ${r.error}`);
    process.exit(1);
  }
  const ext = r.mimeType === "audio/mpeg" ? "mp3" : "bin";
  const path = `${process.env.TEMP ?? "/tmp"}/dentalcare-tts-test.${ext}`;
  await writeFile(path, r.buffer);
  console.log(`✅ ${r.buffer.length}b ${r.mimeType} → ${path}`);
  console.log("   Open it to verify the voice sounds OK.");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
