import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getUnreadConversationsCount } from "@/server/actions/ai-conversations";
import { NAV_SECTIONS } from "./nav-data";
import { SidebarNavItem } from "./sidebar-nav-item";
import { SidebarBadgeRefresh } from "./sidebar-badge-refresh";

/**
 * Floating glass sidebar — Apple Liquid Glass.
 *
 * Sticks to the top of the viewport with a 16px inset so the colored mesh
 * bleeds through the edges. Hidden under `md` (the mobile drawer takes
 * over there). Active nav item gets a gradient + glow shadow to mirror
 * the primary CTA language.
 *
 * Reads nav data from `nav-data.ts` so the desktop sidebar and the
 * mobile drawer never drift out of sync.
 */
export async function AppSidebar({ role }: { role: UserRole }) {
  const tNav = await getTranslations("Nav");

  // Build the full list of hrefs visible to this role so each
  // SidebarNavItem can resolve longest-match active correctly.
  const allHrefs = NAV_SECTIONS.flatMap((s) =>
    s.items.filter((it) => !it.roles || it.roles.includes(role)).map((it) => it.href),
  );

  // Pull the clinic's branding so the sidebar shows the cabinet's
  // actual logo + name (set via /settings), falling back to the
  // DentalCare brand mark when nothing has been uploaded yet.
  const session = await auth();
  const clinic = session?.user
    ? await db.clinic.findUnique({
        where: { id: session.user.clinicId },
        select: { name: true, logoUrl: true },
      })
    : null;
  const clinicName = clinic?.name ?? "DentalCare";
  const logoUrl = clinic?.logoUrl ?? null;

  // Sidebar badge for unread AI conversations. Best-effort — if the
  // call fails (e.g. AI schema not migrated yet) we silently hide it.
  const unreadResult = await getUnreadConversationsCount().catch(() => null);
  const unreadCount = unreadResult && unreadResult.ok ? unreadResult.data : 0;

  return (
    <aside className="glass-thin sticky top-4 hidden h-[calc(100vh-2rem)] flex-col gap-1 overflow-y-auto rounded-3xl p-4 md:flex">
      {/* Polls the unread count every 15s so the badge updates without
          a hard reload. Server Component re-renders on router.refresh(). */}
      <SidebarBadgeRefresh intervalMs={15_000} />
      {/* Brand — clinic logo + name */}
      <Link
        href={"/dashboard" as never}
        className="mb-3 flex items-center gap-3 px-2 pb-4 transition-opacity hover:opacity-80"
      >
        {logoUrl ? (
          <span
            className="border-border/40 bg-white grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border"
            aria-hidden
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt={clinicName} className="h-full w-full object-contain" />
          </span>
        ) : (
          <span
            className="grid size-10 place-items-center rounded-xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_16px_var(--accent-glow)]"
            style={{
              background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
            }}
            aria-hidden
          >
            <svg viewBox="0 0 64 64" className="size-6" fill="currentColor">
              <path d="M32 5C22 5 14 10 12 21C10 32 13 42 17 51L19 56C20 58 23 58 24 56L26 49C27 46 29 44 32 44C35 44 37 46 38 49L40 56C41 58 44 58 45 56L47 51C51 42 54 32 52 21C50 10 42 5 32 5Z" />
            </svg>
          </span>
        )}
        <div className="leading-tight min-w-0">
          <div className="text-foreground truncate text-[15px] font-bold tracking-tight">
            {clinicName}
          </div>
          <div className="text-muted-foreground text-[11px]">Cabinet dentaire</div>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto text-sm">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((it) => !it.roles || it.roles.includes(role));
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.title} className="mb-1">
              <div className="text-muted-foreground/80 px-3 pt-3 pb-1.5 text-[10px] font-bold tracking-[0.06em] uppercase">
                {tNav(section.title as never)}
              </div>
              {visibleItems.map((it) => (
                <SidebarNavItem
                  key={it.href}
                  href={it.href}
                  icon={it.icon}
                  allHrefs={allHrefs}
                  badge={it.href === "/conversations" ? unreadCount : undefined}
                  label={tNav(it.label as never)}
                />
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
