/**
 * Lists every Gemini model your API key has access to.
 * The Google SDK doesn't expose this directly — we hit the REST endpoint.
 */
import "dotenv/config";

async function main() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("GEMINI_API_KEY missing in .env");
    process.exit(1);
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
  );
  if (!res.ok) {
    console.error(`HTTP ${res.status}:`, await res.text());
    process.exit(1);
  }
  const json = (await res.json()) as {
    models?: Array<{
      name: string;
      supportedGenerationMethods?: string[];
      inputTokenLimit?: number;
      outputTokenLimit?: number;
    }>;
  };
  const chatModels = (json.models ?? []).filter((m) =>
    m.supportedGenerationMethods?.includes("generateContent"),
  );
  console.log(`\n${chatModels.length} model(s) supporting generateContent :\n`);
  for (const m of chatModels) {
    const short = m.name.replace("models/", "");
    console.log(`  • ${short}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
