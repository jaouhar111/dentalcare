import { getTranslations } from "next-intl/server";
import { UserRole } from "@prisma/client";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { UserMenu } from "@/components/user-menu";
import { CmdKTrigger } from "@/components/cmdk-trigger";
import { NotificationBell } from "@/components/notification-bell";
import { getNotifications } from "@/server/actions/dashboard";

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
      className="border-border/60 bg-card flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:px-6"
    >
      {/* Left: mobile menu (also reserves space so the centered search stays centered) */}
      <div className="flex flex-1 items-center">
        <button
          type="button"
          aria-label={tTop("openMenu")}
          className="hover:bg-muted rounded p-1.5 md:hidden"
        >
          <svg
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        </button>
      </div>

      {/* Center: search (Cmd+K palette) */}
      <CmdKTrigger />

      {/* Right: notifications + language + profile */}
      <div className="flex flex-1 items-center justify-end gap-2">
        <NotificationBell items={notifications} ariaLabel={tTop("notifications")} />
        <LocaleSwitcher />
        <UserMenu fullName={fullName} email={email} roleLabel={tRole(role)} />
      </div>
    </header>
  );
}
