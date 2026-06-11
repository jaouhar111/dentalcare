import { setRequestLocale } from "next-intl/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/rbac";
import { getActiveAnnouncement } from "@/server/actions/super-admin-announcement";
import { AnnouncementManager } from "../_components/announcement-manager";

export const dynamic = "force-dynamic";

export default async function AnnouncementPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole([UserRole.SUPER_ADMIN]);

  const current = await getActiveAnnouncement();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="page-h1-row">
        <div>
          <h1 className="page-h1">Annonce plateforme</h1>
          <p className="page-sub">
            Bannière affichée en haut du tableau de bord de tous les cabinets
            connectés (maintenance, information produit…).
          </p>
        </div>
      </header>

      <AnnouncementManager
        current={
          current ? { message: current.message, level: current.level } : null
        }
      />
    </div>
  );
}
