import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getPrescription } from "@/server/actions/prescriptions";
import { renderPrescriptionPdf } from "@/lib/pdf/prescription-pdf";
import {
  deliveryUrl,
  isCloudinaryConfigured,
  uploadFile,
} from "@/lib/cloudinary/client";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Generates the prescription PDF, uploads it to Cloudinary, returns the URL.
 * The client then hands that URL to `wa.me/<phone>?text=…` so the patient
 * receives a shareable link they can tap to open the PDF in their browser.
 *
 * Why upload first rather than letting WhatsApp pull from /api/.../pdf:
 *   - /api/.../pdf is auth-gated; the patient (not logged in) would hit the
 *     proxy → 307 to /login → 404 from WhatsApp's link-preview crawler.
 *   - Cloudinary URLs are public + CDN-cached, so WhatsApp can show a
 *     document preview tile when properly configured.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const limit = await rateLimit("share", `${session.user.clinicId}:${clientIp(req.headers)}`);
  if (!limit.success) {
    return NextResponse.json(
      { ok: false, error: "Too many share requests. Please wait a few minutes." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.reset - Date.now()) / 1000)) } },
    );
  }

  const { id } = await params;
  const result = await getPrescription(id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const buf = await renderPrescriptionPdf(result.data);
  const asset = await uploadFile(buf, {
    clinicId: session.user.clinicId,
    bucket: "prescriptions",
    filename: `ordonnance-${result.data.patientName.replace(/[^\w-]+/g, "-")}.pdf`,
    mimeType: "application/pdf",
    resourceType: "image",
  });
  // Force `.pdf` so the browser/WhatsApp see it as a document.
  const url = deliveryUrl(asset.publicId, { format: asset.format ?? "pdf" });

  return NextResponse.json({
    ok: true,
    url,
    warning: isCloudinaryConfigured() ? null : "CLOUDINARY_NOT_CONFIGURED",
  });
}
