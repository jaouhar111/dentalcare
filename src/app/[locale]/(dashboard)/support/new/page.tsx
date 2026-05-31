import { setRequestLocale } from "next-intl/server";
import { UserRole } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { NewTicketForm } from "./new-ticket-form";

export const dynamic = "force-dynamic";

/**
 * Create-ticket form. Server component shell so the auth check runs
 * before the client form mounts; the form itself is a client component
 * that calls `createSupportTicket` then navigates back to /support.
 */
export default async function NewTicketPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole([UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST]);

  return (
    <div className="mx-auto w-full max-w-2xl p-6 lg:p-8">
      <nav className="text-muted-foreground mb-4 flex items-center gap-2 text-[12px]">
        <Link href={"/support" as never} className="hover:text-foreground">
          ← Support
        </Link>
      </nav>
      <header className="mb-6">
        <h1 className="page-h1">Nouveau ticket</h1>
        <p className="page-sub">
          Décrivez votre problème ou votre question. Plus c&apos;est précis,
          plus on peut vous aider vite.
        </p>
      </header>

      <NewTicketForm />
    </div>
  );
}
