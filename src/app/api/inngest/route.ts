import { serve } from "inngest/next";
import { functions, inngest } from "@/lib/inngest";

/**
 * Inngest route handler — the URL Inngest's runtime hits to invoke our
 * functions. `serve()` returns the three handlers (GET / POST / PUT)
 * expected by Inngest's serve protocol.
 *
 * Verify locally:
 *   npx inngest-cli dev -u http://localhost:3000/api/inngest
 *
 * The Inngest dashboard at http://localhost:8288 will show:
 *   - This endpoint registered
 *   - Each registered function (currently: `appointment-created-canary`)
 *   - Live logs when events fire
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
