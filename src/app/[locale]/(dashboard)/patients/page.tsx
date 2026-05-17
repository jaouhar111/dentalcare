import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listPatients } from "@/server/actions/patients";
import { ageInYears, formatDateShort } from "@/lib/utils/format";
import { formatMoroccanPhoneShort } from "@/lib/utils/phone";
import { avatarColor, initialsOf } from "@/lib/utils/avatar";
import { HighlightMatch } from "@/components/highlight-match";
import { NumberedPagination } from "@/components/numbered-pagination";
import { FiltersBar } from "./filters-bar";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function PatientsListPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    page?: string;
    city?: string;
    status?: "all" | "active" | "inactive";
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q = "", page: rawPage = "1", city = "", status = "all" } = await searchParams;

  const t = await getTranslations("Patients");

  const result = await listPatients({
    query: q,
    page: Number(rawPage) || 1,
    city: city || undefined,
    status,
  });

  if (!result.ok) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {result.error.message}
        </div>
      </div>
    );
  }

  const { items, total, page, pageSize, totalPages, newThisMonth, cities } = result.data;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const buildHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (city) params.set("city", city);
    if (status !== "all") params.set("status", status);
    params.set("page", String(nextPage));
    return `/patients?${params.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            <span className="num">{total}</span>{" "}
            {t("subtitle", { count: total }).replace(`${total} `, "")}
            {newThisMonth > 0 && (
              <>
                {" · "}
                <span className="text-emerald-700 dark:text-emerald-300">
                  {t("newThisMonth", { count: newThisMonth })}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            className="border-input hover:bg-muted bg-background text-foreground inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-50"
          >
            <svg
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            {t("export")}
          </button>
          <Link
            href={"/patients/new" as never}
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
        </div>
      </header>

      {/* ─── Filters + Table card ────────────────────────────────────────── */}
      <div className="bg-card border-border/60 overflow-hidden rounded-xl border">
        <FiltersBar cities={cities} />

        {items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="text-foreground text-base font-medium">
              {q || city || status !== "all" ? t("noResults") : t("empty")}
            </div>
            {!q && !city && status === "all" && (
              <>
                <p className="text-muted-foreground mt-1 text-sm">{t("emptyDesc")}</p>
                <Link
                  href={"/patients/new" as never}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition"
                >
                  {t("new")}
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-muted-foreground border-border/60 border-b text-xs tracking-wider uppercase">
                  <tr>
                    <th className="w-10 px-4 py-3 text-start font-semibold">
                      <input
                        type="checkbox"
                        className="border-input text-primary rounded"
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-4 py-3 text-start font-semibold">{t("columns.name")}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t("columns.cin")}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t("columns.phone")}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t("columns.city")}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t("columns.lastVisit")}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t("columns.tags")}</th>
                    <th className="w-8 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-border/60 divide-y">
                  {items.map((p) => {
                    const fullName = `${p.firstName} ${p.lastName}`;
                    const color = avatarColor(fullName);
                    const age = ageInYears(p.dob);
                    return (
                      <tr key={p.id} className="hover:bg-muted/30 group">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            className="border-input rounded"
                            aria-label={`Select ${fullName}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/patients/${p.id}` as never}
                            className="flex items-center gap-3"
                          >
                            <div
                              className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${color.bg} ${color.text}`}
                              aria-hidden
                            >
                              {initialsOf(p.firstName, p.lastName)}
                            </div>
                            <div className="min-w-0">
                              <div className="group-hover:text-primary truncate font-medium transition">
                                <HighlightMatch text={fullName} query={q} />
                              </div>
                              <div className="text-muted-foreground num text-xs">
                                {t("agePatternShort", { years: age })}
                                {p.gender && <> · {t(`gender.${p.gender}`)}</>}
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="num text-muted-foreground px-4 py-3">
                          {p.cin ? <HighlightMatch text={p.cin} query={q} /> : "—"}
                        </td>
                        <td className="num text-muted-foreground px-4 py-3">
                          <HighlightMatch text={formatMoroccanPhoneShort(p.phone)} query={q} />
                        </td>
                        <td className="text-muted-foreground px-4 py-3">{p.city ?? "—"}</td>
                        <td className="num text-muted-foreground px-4 py-3">
                          {p.lastVisitAt ? formatDateShort(p.lastVisitAt, locale as Locale) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {p.hasAllergies ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                              ⚠ {t("tags.allergies")}
                            </span>
                          ) : p.isInactive ? (
                            <span className="bg-muted text-muted-foreground border-border inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                              — {t("tags.inactive")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                              ● {t("tags.ok")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-end">
                          <Link
                            href={`/patients/${p.id}` as never}
                            className="text-muted-foreground hover:text-primary inline-flex"
                            aria-label={fullName}
                          >
                            <svg
                              className="size-4 rtl:rotate-180"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M8.25 4.5l7.5 7.5-7.5 7.5"
                              />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
              <div className="text-muted-foreground">
                {t("pagination.showing", { from, to, total })}
              </div>
              <NumberedPagination
                current={page}
                total={totalPages}
                baseHref="/patients"
                buildHref={buildHref}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
