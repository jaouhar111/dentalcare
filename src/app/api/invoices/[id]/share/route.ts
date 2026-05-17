import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getInvoice } from "@/server/actions/invoices";
import { renderInvoicePdf } from "@/lib/pdf/invoice-pdf";
import {
  deliveryUrl,
  isCloudinaryConfigured,
  uploadFile,
} from "@/lib/cloudinary/client";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Generates the invoice PDF, uploads it to Cloudinary as a public asset, and
 * returns the delivery URL so the client can hand it to WhatsApp via `wa.me`.
 *
 * Why we upload first rather than letting WhatsApp pull from `/api/.../pdf`:
 *   - `/api/.../pdf` is auth-gated; the patient (who is not logged in) would
 *     hit the proxy → 307 to /login → 404 in WhatsApp's preview crawler.
 *   - Cloudinary URLs are public + CDN-cached, render as a document preview
 *     in WhatsApp, and don't expose the dentist's session.
 *
 * In dev (no Cloudinary configured) we fall back to the local `_uploads/`
 * folder; the URL ends up relative and isn't truly shareable but works to
 * verify the UX locally.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // 10 shares / clinic / hour — covers a busy clinic but stops a runaway
  // script from chewing through the Cloudinary monthly quota.
  const limit = await rateLimit("share", `${session.user.clinicId}:${clientIp(req.headers)}`);
  if (!limit.success) {
    return NextResponse.json(
      { ok: false, error: "Too many share requests. Please wait a few minutes." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.reset - Date.now()) / 1000)) } },
    );
  }

  const { id } = await params;
  const result = await getInvoice(id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (result.data.status === "DRAFT") {
    return NextResponse.json(
      { ok: false, error: "Cannot share a draft" },
      { status: 400 },
    );
  }

  const buf = await renderInvoicePdf(result.data);
  const asset = await uploadFile(buf, {
    clinicId: session.user.clinicId,
    bucket: "invoices",
    filename: `${result.data.number ?? "facture"}.pdf`,
    mimeType: "application/pdf",
    // PDFs upload under Cloudinary's "image" resource type so signed URLs work.
    resourceType: "image",
  });
  // `format: "pdf"` forces the `.pdf` extension on the signed URL — without
  // it the link opens as application/octet-stream and the browser shows blank.
  const url = deliveryUrl(asset.publicId, { format: asset.format ?? "pdf" });

  // Surface a warning when Cloudinary isn't configured — the URL is a
  // localhost / `_uploads/` path that the patient won't be able to reach.
  // The client UI shows this as a toast next to the success message.
  return NextResponse.json({
    ok: true,
    url,
    warning: isCloudinaryConfigured() ? null : "CLOUDINARY_NOT_CONFIGURED",
  });
}
