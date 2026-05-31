import { LocaleSwitcher } from "@/components/locale-switcher";
import { UserMenu } from "@/components/user-menu";
import { MobileNavTrigger } from "@/components/mobile-nav-trigger";

/**
 * Slim topbar for the super-admin shell — just locale switcher and
 * user menu. No search palette, no notification bell (those are
 * cabinet-scoped concepts).
 */
export function SuperAdminTopbar({
  fullName,
  email,
}: {
  fullName?: string | null;
  email: string;
}) {
  return (
    <header
      className="glass-thin sticky top-4 z-40 flex h-14 items-center gap-3 rounded-2xl px-4 md:rounded-3xl"
    >
      <div className="flex flex-1 items-center">
        <MobileNavTrigger ariaLabel="Menu" />
      </div>
      <div className="text-foreground/80 hidden text-[12px] font-semibold tracking-wider uppercase md:block">
        Espace propriétaire
      </div>
      <div className="flex flex-1 items-center justify-end gap-1.5">
        <LocaleSwitcher />
        <UserMenu fullName={fullName} email={email} roleLabel="Propriétaire" />
      </div>
    </header>
  );
}
