import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

/**
 * The standalone "Cabinets" list was merged into "Abonnements" — that page
 * is now the single per-cabinet table (plan, statut, essai, actions). The
 * per-cabinet detail still lives at /super-admin/clinics/[id]; only this
 * index redirects so old links and bookmarks keep working.
 */
export default async function SuperAdminClinicsIndexRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireRole([UserRole.SUPER_ADMIN]);
  redirect(`/${locale}/super-admin/subscriptions`);
}
