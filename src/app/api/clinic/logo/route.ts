import { NextResponse, type NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { deliveryUrl, isCloudinaryConfigured, uploadFile } from "@/lib/cloudinary/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/// Bumped from 2 MB to 5 MB — phone cameras produce 3-5 MB shots and
/// users were getting rejected on legitimate uploads straight from
/// their gallery. 5 MB stays under Vercel's 4.5 MB serverless body
/// limit when accounting for multipart overhead on hobby/Pro plans.
/// If we need to go higher we'll switch to a signed direct-to-Cloudinary
/// upload from the browser. Cloudinary downscales server-side so the
/// stored asset stays small regardless.
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"]);

/**
 * Upload clinic logo to Cloudinary and persist the delivery URL on the
 * Clinic row.
 *
 * - POST /api/clinic/logo (multipart, field `file`) → uploads + sets logoUrl
 * - DELETE /api/clinic/logo                          → clears logoUrl
 *
 * Admin-only. Per-file size + mime checks because the request body lands on
 * Vercel functions which charge by bandwidth; rejecting early is the win.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.SUPER_ADMIN)
  ) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Fichier trop volumineux (max 5 Mo)" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { ok: false, error: "Format non supporté (PNG, JPG, SVG, WebP uniquement)" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const asset = await uploadFile(buffer, {
    clinicId: session.user.clinicId,
    bucket: "photos",
    filename: `logo-${session.user.clinicId}.${file.type.split("/")[1] ?? "png"}`,
    mimeType: file.type,
    resourceType: "image",
  });

  const url = deliveryUrl(asset.publicId, { format: asset.format ?? undefined });

  await db.clinic.update({
    where: { id: session.user.clinicId },
    data: { logoUrl: url },
  });

  await audit({
    clinicId: session.user.clinicId,
    userId: session.user.id,
    action: "clinic.logo.upload",
    entity: "Clinic",
    entityId: session.user.clinicId,
    payload: { bytes: file.size, mime: file.type },
  });

  return NextResponse.json({
    ok: true,
    url,
    warning: isCloudinaryConfigured() ? null : "CLOUDINARY_NOT_CONFIGURED",
  });
}

export async function DELETE() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.SUPER_ADMIN)
  ) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  await db.clinic.update({
    where: { id: session.user.clinicId },
    data: { logoUrl: null },
  });
  await audit({
    clinicId: session.user.clinicId,
    userId: session.user.id,
    action: "clinic.logo.remove",
    entity: "Clinic",
    entityId: session.user.clinicId,
  });
  return NextResponse.json({ ok: true });
}
