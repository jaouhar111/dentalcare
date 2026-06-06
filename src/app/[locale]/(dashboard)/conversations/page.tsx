import { getTranslations, setRequestLocale } from "next-intl/server";
import { UserRole, AIConversationStatus } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/rbac";
import {
  getAIConversation,
  listAIConversations,
} from "@/server/actions/ai-conversations";
import { formatMoroccanPhoneShort } from "@/lib/utils/phone";
import { ConversationThread } from "./conversation-thread";
import { ConversationsAutoRefresh } from "./auto-refresh";
import { ConversationsSearch } from "./conversations-search";

export const dynamic = "force-dynamic";

type StatusFilter = "ACTIVE" | "HANDED_OFF" | "CLOSED" | "all";
const FILTERS: StatusFilter[] = ["ACTIVE", "HANDED_OFF", "CLOSED", "all"];

export default async function ConversationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ id?: string; status?: StatusFilter; q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole([UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST]);
  const { id, status: rawStatus, q: rawQuery } = await searchParams;
  const status = FILTERS.includes(rawStatus ?? "all") ? rawStatus : "all";
  const query = (rawQuery ?? "").trim();
  const t = await getTranslations("Conversations");

  const listResult = await listAIConversations({
    status: status && status !== "all" ? (status as AIConversationStatus) : undefined,
    query: query || undefined,
  });
  const items = listResult.ok ? listResult.data : [];

  // Auto-select the first conversation when none requested — gives the
  // admin something to look at on first land instead of an empty thread.
  const selectedId = id ?? items[0]?.id ?? null;
  const detail = selectedId ? await getAIConversation(selectedId) : null;
  const selected = detail && detail.ok ? detail.data : null;

  const formatTime = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const formatDay = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-2 lg:py-2">
      <header className="page-h1-row">
        <div>
          <h1 className="page-h1">{t("title")}</h1>
          <p className="page-sub">
            <span className="num">{items.length}</span>{" "}
            {t("subtitle", { count: items.length }).replace(`${items.length} `, "")}
          </p>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => {
            const active = (status ?? "all") === f;
            const sp = new URLSearchParams();
            if (f !== "all") sp.set("status", f);
            if (query) sp.set("q", query);
            const href = sp.toString() ? `/conversations?${sp.toString()}` : "/conversations";
            return (
              <Link
                key={f}
                href={href as never}
                className={
                  active
                    ? "bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-3 py-1.5 text-xs font-medium"
                }
              >
                {t(`tabs.${f}`)}
              </Link>
            );
          })}
        </div>
        <ConversationsSearch defaultValue={query} placeholder={t("searchPlaceholder")} />
      </div>

      {/* Auto-refresh every 5s — invisible component that calls
          router.refresh() when the tab is visible. */}
      <ConversationsAutoRefresh intervalMs={5000} />


      {items.length === 0 ? (
        <div className="card-glass text-muted-foreground py-16 text-center text-sm">
          {t("empty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          {/* ── Left: list of conversations ─────────────────────────
              On mobile we cap the list at 50vh so the selected thread
              below stays visible without forcing the user to scroll
              past the whole list. */}
          <aside className="chat-list-card max-h-[50vh] overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
            {items.map((c) => {
              const sp = new URLSearchParams();
              sp.set("id", c.id);
              if (status && status !== "all") sp.set("status", status);
              const sameDay = new Date().toDateString() === c.lastActivityAt.toDateString();
              const time = sameDay
                ? formatTime.format(c.lastActivityAt)
                : formatDay.format(c.lastActivityAt);
              return (
                <Link
                  key={c.id}
                  href={`/conversations?${sp.toString()}` as never}
                  className={`chat-list-item ${selectedId === c.id ? "is-active" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {c.unread ? (
                        <span
                          className="size-2 shrink-0 rounded-full bg-[var(--accent-2)] shadow-[0_0_8px_var(--accent-glow)]"
                          aria-label={t("unreadDot")}
                        />
                      ) : null}
                      <span
                        className={`truncate text-[13px] ${
                          c.unread ? "text-foreground font-bold" : "text-foreground font-semibold"
                        }`}
                      >
                        {c.patientName ?? formatMoroccanPhoneShort(c.patientPhone)}
                      </span>
                    </span>
                    <span className="text-muted-foreground shrink-0 text-[10px]">{time}</span>
                  </div>
                  <div
                    className={`mt-1 truncate text-[12px] ${
                      c.unread ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {c.lastSnippet || t("noMessages")}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[10px]">
                    <StatusBadge status={c.status} t={t} />
                    <span className="text-muted-foreground">
                      {c.totalTurns} {t("turns", { count: c.totalTurns }).replace(`${c.totalTurns} `, "")}
                    </span>
                  </div>
                </Link>
              );
            })}
          </aside>

          {/* ── Right: selected thread ───────────────────────────── */}
          {selected ? (
            <ConversationThread
              conversation={selected}
              labels={{
                handover: t("actions.handover"),
                reactivate: t("actions.reactivate"),
                handoverConfirm: t("actions.handoverConfirm"),
                handedOffBy: t("status.handedOffBy"),
                tool: t("messages.tool"),
                createdAt: t("createdAt"),
                tokens: t("tokens"),
                statusActive: t("status.ACTIVE"),
                statusHandedOff: t("status.HANDED_OFF"),
                statusClosed: t("status.CLOSED"),
                adminInputPlaceholder: t("admin.inputPlaceholder"),
                adminSend: t("admin.send"),
                adminHint: t("admin.hint"),
                adminMarker: t("admin.marker"),
                adminMobileMarker: t("admin.mobileMarker"),
                adminSuppressedHint: t("admin.suppressedHint"),
              }}
            />
          ) : (
            <div className="chat-container items-center justify-center">
              <div className="text-muted-foreground p-8 text-center text-sm">
                {t("selectOne")}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: AIConversationStatus;
  t: Awaited<ReturnType<typeof getTranslations<"Conversations">>>;
}) {
  const cls =
    status === AIConversationStatus.ACTIVE
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : status === AIConversationStatus.HANDED_OFF
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : "bg-slate-500/15 text-slate-700 dark:text-slate-300";
  return (
    <span className={`rounded-full px-2 py-0.5 font-medium ${cls}`}>{t(`status.${status}`)}</span>
  );
}
