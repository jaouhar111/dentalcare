import { setRequestLocale } from "next-intl/server";
import { UserRole } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { listMyTickets } from "@/server/actions/support";
import { TicketRow } from "./_components/ticket-row";

export const dynamic = "force-dynamic";

/**
 * Cabinet-side support inbox. Shows every ticket this clinic has
 * opened, sorted by most recent activity. Top-right CTA opens a new
 * ticket form (separate route).
 *
 * Empty state walks the user through the 3 categories most likely
 * to drive a first ticket — "I can't add a patient", "WhatsApp setup",
 * "Plan / billing" — so the user knows the feature is real.
 */
export default async function SupportListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole([UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST]);

  const res = await listMyTickets();
  const tickets = res.ok ? res.data : [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-h1">Support</h1>
          <p className="page-sub">
            Une question, un bug, besoin d&apos;aide ? Ouvrez un ticket — on vous
            répond généralement sous 24 heures.
          </p>
        </div>
        <Link
          href={"/support/new" as never}
          className="bg-primary text-primary-foreground inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-semibold transition-opacity hover:opacity-90"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nouveau ticket
        </Link>
      </header>

      {tickets.length === 0 ? (
        <div className="bg-card rounded-2xl p-10 text-center ring-1 ring-black/[0.04] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.06)]">
          <div className="bg-primary/10 text-primary mx-auto mb-4 grid size-12 place-items-center rounded-2xl">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.85L3 21l1.97-3.94A8.97 8.97 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2 className="text-foreground text-[17px] font-semibold">
            Aucun ticket pour l&apos;instant
          </h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-[14px] leading-[1.55]">
            Vous pouvez nous contacter pour n&apos;importe quoi : un bug
            (« je n&apos;arrive pas à ajouter un patient »), de l&apos;aide
            sur la mise en route WhatsApp, ou une question d&apos;abonnement.
          </p>
          <div className="mx-auto mt-6 grid max-w-md grid-cols-1 gap-2 text-start sm:grid-cols-3">
            <ExampleCard label="Bug" body="Je n'arrive pas à ajouter un patient" />
            <ExampleCard label="WhatsApp" body="Mon bot ne répond plus" />
            <ExampleCard label="Abonnement" body="Comment changer de plan ?" />
          </div>
          <Link
            href={"/support/new" as never}
            className="bg-primary text-primary-foreground mt-7 inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-semibold transition-opacity hover:opacity-90"
          >
            Ouvrir mon premier ticket
          </Link>
        </div>
      ) : (
        <div className="bg-card overflow-hidden rounded-2xl ring-1 ring-black/[0.04] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.06)]">
          <ul className="divide-y divide-black/[0.05]">
            {tickets.map((t) => (
              <TicketRow
                key={t.id}
                ticket={t}
                href={`/support/${t.id}`}
                locale={locale}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ExampleCard({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-xl bg-black/[0.025] p-3 ring-1 ring-black/[0.04]">
      <div className="text-primary text-[10px] font-semibold tracking-[0.06em] uppercase">
        {label}
      </div>
      <div className="text-foreground/80 mt-1 text-[12px] leading-[1.4]">
        « {body} »
      </div>
    </div>
  );
}
