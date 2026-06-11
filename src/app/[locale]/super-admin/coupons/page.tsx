import { setRequestLocale } from "next-intl/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/rbac";
import { getCoupons } from "@/server/actions/super-admin-coupons";
import { CouponsManager } from "../_components/coupons-manager";

export const dynamic = "force-dynamic";

export default async function CouponsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole([UserRole.SUPER_ADMIN]);

  const coupons = await getCoupons();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="page-h1-row">
        <div>
          <h1 className="page-h1">Coupons</h1>
          <p className="page-sub">
            Codes de remise pour les abonnements des cabinets. La redemption
            s&apos;activera avec le paiement en ligne.
          </p>
        </div>
      </header>

      <CouponsManager coupons={coupons} locale={locale} />
    </div>
  );
}
