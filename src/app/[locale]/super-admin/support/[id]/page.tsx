import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { getTicketDetail } from "@/server/actions/support";
import { TicketThread } from "@/app/[locale]/(dashboard)/support/_components/ticket-thread";
import { SuperAdminTicketControls } from "../_super-admin-ticket-controls";

export const dynamic = "force-dynamic";

/**
 * Super-admin ticket detail. Renders the shared `TicketThread`
 * (right-aligned for super-admin bubbles) plus the extra controls
 * panel that lets the owner change priority + status on the fly.
 */
export default async function SuperAdminTicketPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole([UserRole.SUPER_ADMIN]);

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
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <nav className="text-muted-foreground flex items-center gap-2 text-[12px]">
        <Link href={"/super-admin/support" as never} className="hover:text-foreground">
          ← Inbox
        </Link>
        <span>·</span>
        <Link
          href={`/super-admin/clinics/${res.data.clinicId}` as never}
          className="hover:text-foreground"
        >
          {res.data.clinicName}
        </Link>
      </nav>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
        <TicketThread
          ticket={res.data}
          locale={locale}
          isSuperAdminView={true}
        />
        <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
          <SuperAdminTicketControls
            ticketId={res.data.id}
            currentStatus={res.data.status}
            currentPriority={res.data.priority}
          />
        </aside>
      </div>
    </div>
  );
}
