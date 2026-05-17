/**
 * Cloudinary integration for medical images (radiographs + treatment photos).
 *
 * # Operating modes
 *
 * Cloudinary credentials are optional in dev. The module exposes two facades:
 *
 *  - `isCloudinaryConfigured()` returns `true` when all three CLOUDINARY_*
 *    environment variables are set; the rest of the codebase should branch
 *    on this to decide whether to call Cloudinary or fall back to local
 *    storage (under `public/_uploads/<clinicId>/...`).
 *  - `uploadFile()` accepts a `Buffer` and returns the persisted public_id
 *    plus delivery metadata — abstracting whether we hit Cloudinary or write
 *    to disk.
 *  - `deliveryUrl()` builds a signed delivery URL for a given public_id; in
 *    local-fallback mode it returns the static `/​_uploads/...` path.
 *
 * # Folder layout
 *
 * Cloudinary `public_id` is prefixed with `dentalcare/<clinicId>/<bucket>/`
 * where bucket is `radiographs` or `photos`. This keeps clinic data trivially
 * isolatable (e.g. for GDPR deletion) and stays scoped under one Cloudinary
 * account — multi-tenant prep, same approach as our `forClinic` Prisma scope.
 */

import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    return false;
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
  return true;
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
  );
}

export type UploadBucket = "radiographs" | "photos" | "invoices" | "prescriptions";

export interface UploadedAsset {
  publicId: string;
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
}

/**
 * Upload a binary blob and return the persisted public_id + metadata.
 *
 * @param buffer  Raw bytes of the file.
 * @param opts.clinicId Clinic scope — drives folder layout.
 * @param opts.bucket   "radiographs" or "photos".
 * @param opts.filename Optional original filename (only used for the local
 *                      fallback's on-disk name; Cloudinary derives its own).
 * @param opts.mimeType Best-effort content type — used to pick a default
 *                      extension in the local fallback when filename is absent.
 */
export async function uploadFile(
  buffer: Buffer,
  opts: {
    clinicId: string;
    bucket: UploadBucket;
    filename?: string;
    mimeType?: string;
    /// Cloudinary resource type. PDFs and other non-image files need "raw"
    /// or "image" with format set; for `application/pdf` we use "image" so
    /// Cloudinary keeps the file natively (raw URLs lack signed transforms).
    /// Defaults to "image" for backwards compatibility with Phase 5.
    resourceType?: "image" | "raw" | "video";
  },
): Promise<UploadedAsset> {
  const folder = `dentalcare/${opts.clinicId}/${opts.bucket}`;
  const resource_type = opts.resourceType ?? "image";

  if (ensureConfigured()) {
    const result: UploadApiResponse = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,
            resource_type,
            type: "upload",
          },
          (err, res) => {
            if (err || !res) reject(err ?? new Error("UPLOAD_FAILED"));
            else resolve(res);
          },
        )
        .end(buffer);
    });
    return {
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
    };
  }

  // ─── Local fallback (dev only) ───
  // Persisted under public/_uploads/<clinicId>/<bucket>/<random>.<ext>.
  const ext = guessExtension(opts.filename, opts.mimeType);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const relDir = path.posix.join("_uploads", opts.clinicId, opts.bucket);
  const absDir = path.join(process.cwd(), "public", relDir);
  await fs.mkdir(absDir, { recursive: true });
  const filename = `${id}.${ext}`;
  await fs.writeFile(path.join(absDir, filename), buffer);
  // We store the FULL relative path (including extension) as publicId for the
  // local fallback. This makes `deliveryUrl` a no-op.
  return {
    publicId: `${relDir}/${filename}`,
    format: ext,
    bytes: buffer.length,
  };
}

/**
 * Delete an asset by public_id. Returns silently when Cloudinary is not
 * configured (local fallback) — files on disk are best-effort removed.
 */
export async function deleteAsset(publicId: string): Promise<void> {
  if (ensureConfigured()) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    } catch {
      // Best-effort: swallow Cloudinary errors — caller already deleted the
      // DB row; an orphaned remote asset is recoverable, a hard failure here
      // would block the user.
    }
    return;
  }
  // Local fallback: try to unlink the on-disk file.
  if (publicId.startsWith("_uploads/")) {
    try {
      await fs.unlink(path.join(process.cwd(), "public", publicId));
    } catch {
      // ignore — file may already be gone
    }
  }
}

/**
 * Build a delivery URL for a given asset. In Cloudinary mode we sign the URL
 * so URLs can't be replayed indefinitely. In local fallback mode we serve
 * from `/_uploads/...` — and we prefix with NEXTAUTH_URL when configured so
 * the URL is at least absolute (helps the dentist verify the PDF locally;
 * still won't reach the patient because localhost isn't externally routable).
 */
export function deliveryUrl(
  publicId: string,
  opts?: {
    width?: number;
    height?: number;
    resourceType?: "image" | "raw" | "video";
    /// Force an output format (Cloudinary appends `.<format>` to the URL).
    /// REQUIRED for PDFs uploaded as `image` — otherwise the URL has no
    /// extension and browsers/WhatsApp can't render it as a document.
    format?: string;
  },
): string {
  if (ensureConfigured()) {
    return cloudinary.url(publicId, {
      sign_url: true,
      type: "upload",
      resource_type: opts?.resourceType ?? "image",
      secure: true,
      format: opts?.format,
      transformation: opts?.width || opts?.height
        ? [{ width: opts.width, height: opts.height, crop: "fit" }]
        : undefined,
    });
  }
  // Local fallback: publicId is the relative path under `/public`. Prepend
  // NEXTAUTH_URL when present so the URL is absolute and clickable from
  // outside the page; otherwise stay relative.
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";
  return `${base}/${publicId}`;
}

function guessExtension(filename?: string, mimeType?: string): string {
  if (filename) {
    const dot = filename.lastIndexOf(".");
    if (dot >= 0 && dot < filename.length - 1) return filename.slice(dot + 1).toLowerCase();
  }
  if (mimeType?.startsWith("image/")) return mimeType.slice("image/".length).toLowerCase();
  return "bin";
}
