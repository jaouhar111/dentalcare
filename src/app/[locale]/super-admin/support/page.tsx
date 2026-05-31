import { setRequestLocale } from "next-intl/server";
import {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
  UserRole,
} from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/rbac";
import {
  getInboxCounts,
  listAllTickets,
} from "@/server/actions/super-admin-support";
import { TicketRow } from "@/app/[locale]/(dashboard)/support/_components/ticket-row";
import {
  CATEGORY_LABEL,
  PRIORITY_STYLE,
  STATUS_STYLE,
} from "@/app/[locale]/(dashboard)/support/_components/labels";

export const dynamic = "force-dynamic";

const STATUS_FILTERS: Array<SupportTicketStatus | "ALL"> = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_USER",
  "RESOLVED",
  "ALL",
];

const STATUS_LABEL: Record<SupportTicketStatus | "ALL" | "TOTAL", string> = {
  OPEN: "Ouverts",
  IN_PROGRESS: "En cours",
  WAITING_USER: "En attente cabinet",
  RESOLVED: "Résolus",
  ALL: "Tous",
  TOTAL: "Total",
};

const PRIORITY_FILTERS: Array<SupportTicketPriority | "ALL"> = [
  "ALL",
  "URGENT",
  "HIGH",
  "NORMAL",
  "LOW",
];

const CATEGORY_FILTERS: Array<SupportTicketCategory | "ALL"> = [
  "ALL",
  "TECHNICAL_BUG",
  "WHATSAPP",
  "BILLING",
  "HOW_TO",
  "ACCOUNT",
  "FEATURE_REQUEST",
  "OTHER",
];

/**
 * Cross-tenant support inbox for the SUPER_ADMIN. Three filter axes
 * (status / priority / category) wired as URL search params so a
 * specific view ("all urgent WhatsApp bugs") can be bookmarked.
 *
 * Tabs at the top show status counts ("Ouverts (3) · En cours (1)…").
 * Default view = OPEN to match "what needs my attention right now".
 */
export default async function SuperAdminSupportInbox({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    status?: string;
    priority?: string;
    category?: string;
  }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  await requireRole([UserRole.SUPER_ADMIN]);

  const status = (sp.status as SupportTicketStatus | "ALL" | undefined) ?? "OPEN";
  const priority = (sp.priority as SupportTicketPriority | "ALL" | undefined) ?? "ALL";
  const category = (sp.category as SupportTicketCategory | "ALL" | undefined) ?? "ALL";

  const [ticketsRes, countsRes] = await Promise.all([
    listAllTickets({ status, priority, category }),
    getInboxCounts(),
  ]);
  const tickets = ticketsRes.ok ? ticketsRes.data : [];
  const counts = countsRes.ok
    ? countsRes.data
    : { OPEN: 0, IN_PROGRESS: 0, WAITING_USER: 0, RESOLVED: 0, TOTAL: 0 };

  function buildHref(next: {
    status?: string;
    priority?: string;
    category?: string;
  }) {
    const u = new URLSearchParams();
    const s = next.status ?? status;
    const p = next.priority ?? priority;
    const c = next.category ?? category;
    if (s && s !== "OPEN") u.set("status", s);
    if (p && p !== "ALL") u.set("priority", p);
    if (c && c !== "ALL") u.set("category", c);
    const q = u.toString();
    return q ? `/super-admin/support?${q}` : "/super-admin/support";
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header>
        <h1 className="text-foreground text-[24px] font-semibold tracking-tight">
          Support
        </h1>
        <p className="text-muted-foreground mt-1 text-[13px]">
          Inbox cross-cabinet. Trié par priorité puis dernière activité.
        </p>
      </header>

      {/* Status pills with counts */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((s) => {
          const active = s === status;
          const count =
            s === "ALL" ? counts.TOTAL : counts[s as SupportTicketStatus] ?? 0;
          const tone =
            s === "ALL" ? null : STATUS_STYLE[s as SupportTicketStatus];
          return (
            <Link
              key={s}
              href={buildHref({ status: s }) as never}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                active
                  ? "border-primary bg-primary/[0.08] text-foreground"
                  : "border-black/[0.06] text-muted-foreground hover:bg-black/[0.03] hover:text-foreground"
              }`}
            >
              {tone ? (
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: tone.dot }}
                  aria-hidden
                />
              ) : null}
              {STATUS_LABEL[s]}
              <span className="text-muted-foreground tabular-nums">({count})</span>
            </Link>
          );
        })}
      </div>

      {/* Secondary filter row: priority + category */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FilterDropdown
          label="Priorité"
          value={priority}
          buildHref={(v) => buildHref({ priority: v })}
          options={PRIORITY_FILTERS.map((p) => ({
            value: p,
            label: p === "ALL" ? "Toutes priorités" : PRIORITY_STYLE[p].label,
            dot: p !== "ALL" ? PRIORITY_STYLE[p].dot : undefined,
          }))}
        />
        <FilterDropdown
          label="Catégorie"
          value={category}
          buildHref={(v) => buildHref({ category: v })}
          options={CATEGORY_FILTERS.map((c) => ({
            value: c,
            label: c === "ALL" ? "Toutes catégories" : CATEGORY_LABEL[c],
          }))}
        />
      </div>

      {/* Inbox */}
      {tickets.length === 0 ? (
        <div className="bg-card rounded-2xl p-12 text-center ring-1 ring-black/[0.04]">
          <div className="text-muted-foreground text-[14px]">
            Aucun ticket ne correspond aux filtres actuels.
          </div>
        </div>
      ) : (
        <div className="bg-card overflow-hidden rounded-2xl ring-1 ring-black/[0.04] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.06)]">
          <ul className="divide-y divide-black/[0.05]">
            {tickets.map((t) => (
              <TicketRow
                key={t.id}
                ticket={t}
                href={`/super-admin/support/${t.id}`}
                locale={locale}
                rightSlot={
                  <div className="hidden items-center gap-2 sm:flex">
                    {t.clinicLogoUrl ? (
                      <span className="border-border/40 bg-white grid size-7 shrink-0 place-items-center overflow-hidden rounded-lg border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={t.clinicLogoUrl}
                          alt={t.clinicName}
                          className="h-full w-full object-contain"
                        />
                      </span>
                    ) : (
                      <span
                        className="grid size-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold text-white"
                        style={{ background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))" }}
                        aria-hidden
                      >
                        {t.clinicName.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="text-muted-foreground max-w-[10rem] truncate text-[12px] font-medium">
                      {t.clinicName}
                    </span>
                  </div>
                }
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FilterDropdown({
  label,
  value,
  options,
  buildHref,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string; dot?: string }>;
  buildHref: (v: string) => string;
}) {
  return (
    <div className="bg-card rounded-2xl p-4 ring-1 ring-black/[0.04]">
      <div className="text-muted-foreground mb-2 text-[11px] font-medium tracking-[0.08em] uppercase">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Link
              key={o.value}
              href={buildHref(o.value) as never}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                active
                  ? "bg-primary/[0.10] text-primary ring-primary/30 ring-1"
                  : "text-muted-foreground hover:bg-black/[0.04] hover:text-foreground"
              }`}
            >
              {o.dot ? (
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: o.dot }}
                  aria-hidden
                />
              ) : null}
              {o.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
