import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { logoutAction } from "@/server/actions/auth";

export const dynamic = "force-dynamic";

/**
 * Lock-out screen for a suspended cabinet. Lives OUTSIDE the (dashboard)
 * route group so the layout's suspension gate can redirect here without
 * looping. Only reachable by a logged-in user whose cabinet is actually
 * suspended — everyone else is bounced to their normal home.
 */
export default async function SuspendedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (session.user.role === UserRole.SUPER_ADMIN) {
    redirect(`/${locale}/super-admin`);
  }

  const clinic = await db.clinic.findUnique({
    where: { id: session.user.clinicId },
    select: { name: true, suspendedAt: true, suspendedReason: true },
  });
  // Not actually suspended → back to the normal app.
  if (!clinic?.suspendedAt) redirect(`/${locale}/dashboard`);

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="bg-card border-border/60 w-full max-w-md rounded-2xl border p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_60px_-24px_rgba(15,23,42,0.12)]">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>

        <h1 className="text-foreground mt-5 text-xl font-semibold tracking-tight">
          Accès suspendu
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          L&apos;accès de <span className="text-foreground font-medium">{clinic.name}</span> a
          été temporairement suspendu par l&apos;administration de la plateforme.
        </p>

        {clinic.suspendedReason ? (
          <p className="bg-muted/50 text-foreground/80 mt-4 rounded-xl p-3 text-left text-[13px] leading-relaxed">
            <span className="text-muted-foreground block text-[11px] font-medium tracking-wider uppercase">
              Motif
            </span>
            {clinic.suspendedReason}
          </p>
        ) : null}

        <p className="text-muted-foreground mt-4 text-[13px]">
          Pour rétablir l&apos;accès, contactez le support :{" "}
          <a
            className="text-primary font-medium underline-offset-2 hover:underline"
            href="mailto:support@dentalcare.ma"
          >
            support@dentalcare.ma
          </a>
        </p>

        <form action={logoutAction} className="mt-6">
          <button
            type="submit"
            className="border-input hover:bg-muted bg-background inline-flex h-9 items-center rounded-lg border px-4 text-sm font-medium transition"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
