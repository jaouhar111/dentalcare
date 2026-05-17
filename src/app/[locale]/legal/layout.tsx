import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * Layout pour les pages publiques de mentions légales / CGU / politique
 * de confidentialité. Pas d'auth requise — elles doivent être consultables
 * sans compte (et indexables par Google).
 */
export default async function LegalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="bg-background min-h-screen">
      <header className="border-border/60 border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            DentalCare
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link
              href={"/legal/mentions-legales" as never}
              className="text-muted-foreground hover:text-foreground"
            >
              Mentions légales
            </Link>
            <Link
              href={"/legal/privacy" as never}
              className="text-muted-foreground hover:text-foreground"
            >
              Confidentialité
            </Link>
            <Link
              href={"/legal/cgu" as never}
              className="text-muted-foreground hover:text-foreground"
            >
              CGU
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <article className="prose prose-slate dark:prose-invert max-w-none [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_p]:my-3 [&_p]:leading-7 [&_ul]:my-3 [&_ul]:ml-6 [&_ul]:list-disc [&_li]:my-1 [&_a]:text-cyan-700 [&_a]:underline dark:[&_a]:text-cyan-400">
          {children}
        </article>
      </main>
      <footer className="border-border/60 mt-10 border-t py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} DentalCare. Tous droits réservés.
      </footer>
    </div>
  );
}
