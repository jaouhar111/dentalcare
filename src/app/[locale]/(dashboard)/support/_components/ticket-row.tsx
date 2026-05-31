import { Link } from "@/i18n/navigation";
import type { SupportTicketListItem } from "@/server/actions/support-types";
import { CATEGORY_LABEL, PRIORITY_STYLE, STATUS_STYLE } from "./labels";

/**
 * One row in either the cabinet's own inbox or the super-admin's
 * cross-tenant inbox. The `href` is whatever route the parent wants
 * to deep-link into — the cabinet path is `/support/[id]`, the
 * super-admin path is `/super-admin/support/[id]`.
 */
export function TicketRow({
  ticket,
  href,
  locale,
  rightSlot,
}: {
  ticket: SupportTicketListItem;
  href: string;
  locale: string;
  /// Optional right-aligned slot (used by the super-admin row to show
  /// the clinic avatar). Cabinet row leaves it empty.
  rightSlot?: React.ReactNode;
}) {
  const statusStyle = STATUS_STYLE[ticket.status];
  const priorityStyle = PRIORITY_STYLE[ticket.priority];
  const fmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <li>
      <Link
        href={href as never}
        className="hover:bg-black/[0.02] flex items-center gap-4 px-5 py-4 transition-colors"
      >
        {/* Priority dot */}
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: priorityStyle.dot }}
          aria-label={`Priorité ${ticket.priority}`}
        />

        {/* Subject + meta line */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-foreground truncate text-[14px] font-semibold">
              {ticket.subject}
            </h3>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyle.cls}`}
            >
              <span
                className="size-1 rounded-full"
                style={{ background: statusStyle.dot }}
                aria-hidden
              />
              {statusStyle.label}
            </span>
          </div>
          <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            <span className="rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-medium">
              {CATEGORY_LABEL[ticket.category]}
            </span>
            <span className="opacity-60">·</span>
            <span>{ticket.createdByName}</span>
            <span className="opacity-60">·</span>
            <span>{fmt.format(ticket.lastActivityAt)}</span>
            {ticket.replyCount > 0 ? (
              <>
                <span className="opacity-60">·</span>
                <span className="text-primary font-medium">
                  {ticket.replyCount}{" "}
                  {ticket.replyCount === 1 ? "réponse" : "réponses"}
                </span>
              </>
            ) : null}
          </div>
        </div>

        {rightSlot}

        <svg className="text-muted-foreground/60 size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </li>
  );
}
