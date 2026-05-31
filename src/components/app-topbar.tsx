import { getTranslations } from "next-intl/server";
import { UserRole } from "@prisma/client";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { UserMenu } from "@/components/user-menu";
import { CmdKTrigger } from "@/components/cmdk-trigger";
import { NotificationBell } from "@/components/notification-bell";
import { MobileNavTrigger } from "@/components/mobile-nav-trigger";
import { getNotifications } from "@/server/actions/dashboard";

/**
 * Floating glass topbar — Apple Liquid Glass.
 *
 * Sticky at the top of the main column with the same 16px inset as the
 * sidebar. Rounded `rounded-3xl` matches the sidebar pill so the whole
 * chrome feels like a single floating shell.
 */
export async function AppTopbar({
  fullName,
  email,
  role,
}: {
  fullName?: string | null;
  email: string;
  role: UserRole;
}) {
  const tTop = await getTranslations("Topbar");
  const tRole = await getTranslations("Role");
  const notifications = await getNotifications();

  return (
    <header
      data-app-topbar
      className="glass-thin sticky top-4 z-40 flex h-14 items-center gap-3 rounded-2xl px-4 md:rounded-3xl"
    >
      {/* Left: mobile menu (reserves space so the centered search stays centered) */}
      <div className="flex flex-1 items-center">
        <MobileNavTrigger ariaLabel={tTop("openMenu")} />
      </div>

      {/* Center: search (Cmd+K palette) */}
      <CmdKTrigger />

      {/* Right: notifications + language + profile */}
      <div className="flex flex-1 items-center justify-end gap-1.5">
        <NotificationBell items={notifications} ariaLabel={tTop("notifications")} />
        <LocaleSwitcher />
        <UserMenu fullName={fullName} email={email} roleLabel={tRole(role)} />
      </div>
    </header>
  );
}
