import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmDialogProvider } from "@/components/confirm-dialog";
import { SuperAdminSidebar } from "./_components/sidebar";
import { SuperAdminTopbar } from "./_components/topbar";
import { SuperAdminMobileDrawer } from "./_components/mobile-drawer";

/**
 * Platform-owner shell. Distinct from the cabinet dashboard layout:
 * gold-accented sidebar, no clinic-scoped nav items, no subscription
 * paywall (the owner gates other people, not themselves).
 *
 * Auth-gated to SUPER_ADMIN; anyone else who hits /super-admin lands
 * on / (which then re-redirects to /login or /billing as appropriate).
 */
export default async function SuperAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/${locale}/login` as never);
  }
  if (session.user.role !== UserRole.SUPER_ADMIN) {
    // Non-owners shouldn't even know this area exists.
    redirect(`/${locale}` as never);
  }

  return (
    <ConfirmDialogProvider>
      {/* Same Liquid Glass mesh as the cabinet shell — owner area
          reuses the standard background so the visual vocabulary stays
          consistent across the platform. */}
      <div className="md:grid md:grid-cols-[260px_1fr] md:gap-4 md:p-4 min-h-screen">
        <SuperAdminSidebar fullName={session.user.name ?? null} email={session.user.email} />
        <SuperAdminMobileDrawer
          fullName={session.user.name ?? null}
          email={session.user.email}
        />
        <div className="flex min-w-0 flex-col gap-4 px-3 pt-3 md:px-0 md:pt-0">
          <SuperAdminTopbar
            fullName={session.user.name}
            email={session.user.email}
          />
          <main className="flex flex-1 flex-col px-1 pb-8 md:px-2 md:pb-0">
            {children}
          </main>
        </div>
        <Toaster position="top-right" closeButton />
      </div>
    </ConfirmDialogProvider>
  );
}
