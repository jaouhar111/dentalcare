import { NextResponse, type NextRequest } from "next/server";
import { exportPatientData } from "@/server/actions/gdpr";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stream a patient's GDPR export zip.
 *
 * Auth: required (the action verifies clinic scope too).
 * Rate limit: same bucket as `/share` — generating a zip is expensive enough
 * that we don't want it spammed.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const limit = await rateLimit("share", `gdpr:${session.user.clinicId}:${clientIp(req.headers)}`);
  if (!limit.success) {
    return NextResponse.json(
      { ok: false, error: "Too many export requests. Please wait a few minutes." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.reset - Date.now()) / 1000)) } },
    );
  }

  const { id } = await params;
  const result = await exportPatientData(id);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error.message },
      { status: result.error.code === "NOT_FOUND" ? 404 : 400 },
    );
  }

  return new NextResponse(new Uint8Array(result.data.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${result.data.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
