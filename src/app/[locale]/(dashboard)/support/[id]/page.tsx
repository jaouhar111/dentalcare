import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { getTicketDetail } from "@/server/actions/support";
import { TicketThread } from "../_components/ticket-thread";

export const dynamic = "force-dynamic";

/**
 * Cabinet-side ticket detail. Re-uses the shared `TicketThread`
 * component so the visual is identical to the super-admin view (just
 * minus the priority/status override controls).
 */
export default async function CabinetTicketPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole([UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST]);

  const res = await getTicketDetail(id);
  if (!res.ok) {
    if (res.error.code === "NOT_FOUND" || res.error.code === "FORBIDDEN") {
      notFound();
    }
    return (
      <div className="p-6">
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {res.error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6 lg:p-8">
      <nav className="text-muted-foreground flex items-center gap-2 text-[12px]">
        <Link href={"/support" as never} className="hover:text-foreground">
          ← Mes tickets
        </Link>
      </nav>
      <TicketThread ticket={res.data} locale={locale} isSuperAdminView={false} />
    </div>
  );
}
