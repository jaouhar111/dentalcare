import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getPrescription } from "@/server/actions/prescriptions";
import { renderPrescriptionPdf } from "@/lib/pdf/prescription-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streams a prescription as a real PDF. Same auth + pattern as the invoice
 * PDF route (Phase 9) so the dentist can hit /api/prescriptions/[id]/pdf in
 * a new tab and use the browser's print/download.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  const result = await getPrescription(id);
  if (!result.ok) {
    return new NextResponse("Not found", { status: 404 });
  }
  const buf = await renderPrescriptionPdf(result.data);
  const isDownload = req.nextUrl.searchParams.get("download") === "1";
  const safeName = result.data.patientName.replace(/[^\w-]+/g, "-");
  const filename = `ordonnance-${safeName}.pdf`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
