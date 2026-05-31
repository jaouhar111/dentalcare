import { setRequestLocale } from "next-intl/server";
import { UserRole } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { getAIReceptionistSettings } from "@/server/actions/ai-receptionist";
import { AIReceptionistForm } from "./ai-receptionist-form";

export const dynamic = "force-dynamic";

/**
 * AI Receptionist — settings page (Phase 10).
 *
 * Server shell : auth gate (ADMIN only) + initial load of the current
 * settings. The interactive form is a client component so the toggle
 * fires `updateAIReceptionistSettings` without a full reload.
 */
export default async function AIReceptionistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole([UserRole.ADMIN]);

  const res = await getAIReceptionistSettings();
  if (!res.ok) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {res.error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6 lg:p-8">
      <nav className="text-muted-foreground mb-4 flex items-center gap-2 text-[12px]">
        <Link href={"/settings" as never} className="hover:text-foreground">
          ← Paramètres
        </Link>
      </nav>

      <header className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#0071e3]/10 px-3 py-1 text-[11px] font-semibold tracking-[0.04em] text-[#0066cc] uppercase">
          <span className="size-1.5 rounded-full bg-[#0071e3]" />
          AI Receptionist
        </div>
        <h1 className="text-foreground text-[28px] leading-tight font-semibold tracking-tight">
          La réceptionniste qui ne dort jamais.
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-[15px] leading-[1.5]">
          Configurez le ton, les messages et la signature du bot WhatsApp.
          Vous pouvez aussi le désactiver complètement à tout moment —
          les messages seront alors transférés à votre équipe.
        </p>
      </header>

      <AIReceptionistForm initial={res.data} />
    </div>
  );
}
