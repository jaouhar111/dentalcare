import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmDialogProvider } from "@/components/confirm-dialog";
import { LegalFooter } from "@/components/legal-footer";
import { isRtl } from "@/i18n/routing";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    // typedRoutes can't statically resolve the locale-prefixed path; cast to satisfy.
    redirect(`/${locale}/login` as never);
  }

  return (
    <ConfirmDialogProvider>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar role={session.user.role} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppTopbar
            fullName={session.user.name}
            email={session.user.email}
            role={session.user.role}
          />
          <main className="flex flex-1 flex-col overflow-y-auto">
            <div className="flex-1">{children}</div>
            <LegalFooter />
          </main>
        </div>
        <Toaster position={isRtl(locale) ? "top-left" : "top-right"} closeButton />
      </div>
    </ConfirmDialogProvider>
  );
}
