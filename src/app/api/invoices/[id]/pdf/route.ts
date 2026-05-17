import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getInvoice } from "@/server/actions/invoices";
import { renderInvoicePdf } from "@/lib/pdf/invoice-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streams an invoice as a real PDF (rendered server-side via @react-pdf/renderer).
 *
 * Auth: requires a logged-in staff session — the `getInvoice` server action
 * already enforces clinic scoping. We re-check the session here so we don't
 * accidentally serve a PDF on a request that bypassed the proxy.
 *
 * Usage:
 *   - GET → returns the PDF inline (`Content-Disposition: inline`) so the
 *     browser shows the print dialog if you visit the URL directly.
 *   - GET ?download=1 → forces download with the invoice number as filename.
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
  const result = await getInvoice(id);
  if (!result.ok) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (result.data.status === "DRAFT") {
    return new NextResponse("Cannot PDF a draft", { status: 400 });
  }

  const buf = await renderInvoicePdf(result.data);
  const isDownload = req.nextUrl.searchParams.get("download") === "1";
  const filename = `${result.data.number ?? "facture"}.pdf`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
