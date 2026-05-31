import { Link } from "@/i18n/navigation";
import { SA_NAV } from "./nav-data";
import { SaNavItem } from "./nav-item";

/**
 * Platform-owner sidebar (desktop ≥md). Floating Liquid Glass pill,
 * same geometry as the cabinet one but with the gold accent reserved
 * for the active state to mark the "owner mode" context.
 *
 * Owner identity stripe at the bottom — replaces the cabinet brand
 * since this is YOUR area, not a cabinet.
 */
export function SuperAdminSidebar({
  fullName,
  email,
}: {
  fullName: string | null;
  email: string;
}) {
  const allHrefs = SA_NAV.map((n) => n.href);
  return (
    <aside className="glass-thin sticky top-4 hidden h-[calc(100vh-2rem)] flex-col gap-1 overflow-y-auto rounded-3xl p-4 md:flex">
      {/* Brand stripe — same cyan accent as the cabinet shell */}
      <Link
        href={"/super-admin" as never}
        className="mb-3 flex items-center gap-3 px-2 pb-4 transition-opacity hover:opacity-80"
      >
        <span
          className="grid size-10 place-items-center rounded-xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_16px_var(--accent-glow)]"
          style={{ background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))" }}
          aria-hidden
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
            <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        </span>
        <div className="leading-tight min-w-0">
          <div className="text-foreground truncate text-[15px] font-bold tracking-tight">
            Plateforme
          </div>
          <div className="text-muted-foreground text-[11px]">Espace propriétaire</div>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto text-sm">
        {SA_NAV.map((n) => (
          <SaNavItem
            key={n.href}
            href={n.href}
            icon={n.icon}
            label={n.label}
            allHrefs={allHrefs}
          />
        ))}
      </nav>

      {/* Identity stripe at the bottom */}
      <div className="border-border/40 mt-3 border-t pt-3">
        <div className="text-foreground truncate text-[13px] font-semibold">
          {fullName ?? "—"}
        </div>
        <div className="text-muted-foreground truncate text-[11px]">{email}</div>
      </div>
    </aside>
  );
}
