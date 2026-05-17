import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { listDentists } from "@/server/actions/dentists";
import { formatMoroccanPhone } from "@/lib/utils/phone";

export const dynamic = "force-dynamic";

export default async function DentistsListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Admin-only screen.
  const session = await auth();
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    redirect(`/${locale}` as never);
  }

  const t = await getTranslations("Dentists");
  const result = await listDentists();

  if (!result.ok) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {result.error.message}
        </div>
      </div>
    );
  }

  const items = result.data;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {t("subtitle", { count: items.length })}
          </p>
        </div>
        <Link
          href={"/dentists/new" as never}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition"
        >
          <svg
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t("new")}
        </Link>
      </header>

      <div className="bg-card border-border/60 rounded-xl border">
        {items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="text-foreground text-base font-medium">{t("empty")}</div>
            <p className="text-muted-foreground mt-1 text-sm">{t("emptyDesc")}</p>
            <Link
              href={"/dentists/new" as never}
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition"
            >
              {t("new")}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground border-border/60 border-b text-xs tracking-wider uppercase">
                <tr>
                  <th className="px-4 py-3 text-start font-semibold">{t("columns.name")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("columns.specialty")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("columns.phone")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("columns.schedule")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("columns.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-border/60 divide-y">
                {items.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/30 group cursor-pointer">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dentists/${d.id}` as never}
                        className="group-hover:text-primary flex items-center gap-3"
                      >
                        <span
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: d.color }}
                          aria-hidden
                        />
                        <span className="font-medium">
                          Dr {d.firstName} {d.lastName}
                        </span>
                      </Link>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">{d.specialty ?? "—"}</td>
                    <td className="num text-muted-foreground px-4 py-3">
                      {d.phone ? formatMoroccanPhone(d.phone) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {d.scheduleDayCount > 0 ? (
                        <span className="text-emerald-700 dark:text-emerald-300">
                          {t("scheduleDays", { count: d.scheduleDayCount })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{t("noSchedule")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {d.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                          ● {t("active")}
                        </span>
                      ) : (
                        <span className="bg-muted text-muted-foreground border-border inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                          ○ {t("inactive")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
