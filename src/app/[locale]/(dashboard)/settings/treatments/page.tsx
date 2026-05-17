import { getTranslations, setRequestLocale } from "next-intl/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/rbac";
import { listCatalogItems } from "@/server/actions/treatments";
import { formatCurrency } from "@/lib/utils/format";
import { TreatmentFormDialog } from "./treatment-form";
import { DeactivateButton } from "./deactivate-button";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function TreatmentsSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ inactive?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { inactive } = await searchParams;
  await requireRole([UserRole.ADMIN]);

  const t = await getTranslations("Treatments");
  const showInactive = inactive === "1";

  const result = await listCatalogItems(showInactive);
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
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            <span className="num">{items.length}</span>{" "}
            {t("subtitle", { count: items.length }).replace(`${items.length} `, "")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`?inactive=${showInactive ? "0" : "1"}`}
            className="border-input hover:bg-muted bg-background text-foreground inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition"
          >
            {showInactive ? "✓ " : ""}
            {t("showInactive")}
          </a>
          <TreatmentFormDialog mode="create" />
        </div>
      </header>

      {items.length === 0 ? (
        <div className="bg-card border-border/60 rounded-xl border px-6 py-16 text-center">
          <div className="text-foreground text-base font-medium">{t("empty")}</div>
          <p className="text-muted-foreground mt-1 text-sm">{t("emptyDesc")}</p>
        </div>
      ) : (
        <div className="bg-card border-border/60 overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground border-border/60 border-b text-xs tracking-wider uppercase">
              <tr>
                <th className="px-4 py-3 text-start font-semibold">{t("columns.code")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("columns.name")}</th>
                <th className="px-4 py-3 text-end font-semibold">{t("columns.price")}</th>
                <th className="px-4 py-3 text-end font-semibold">{t("columns.duration")}</th>
                <th className="px-4 py-3 text-center font-semibold">{t("columns.requiresTooth")}</th>
                <th className="px-4 py-3 text-center font-semibold">{t("columns.status")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: it.color }}
                        aria-hidden
                      />
                      <span className="num text-foreground font-mono text-xs font-semibold">
                        {it.code}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{it.name}</div>
                    {it.description && (
                      <div className="text-muted-foreground mt-0.5 text-xs">{it.description}</div>
                    )}
                  </td>
                  <td className="num text-foreground px-4 py-3 text-end font-medium">
                    {formatCurrency(it.defaultPrice, locale as Locale)}
                  </td>
                  <td className="num text-muted-foreground px-4 py-3 text-end">
                    {it.defaultDurationMin} min
                  </td>
                  <td className="px-4 py-3 text-center">
                    {it.requiresTooth ? (
                      <span className="text-primary text-xs">●</span>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {it.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {t("active")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground border-border bg-muted inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                        {t("inactive")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="flex justify-end gap-1">
                      <TreatmentFormDialog mode="edit" item={it} />
                      {it.isActive && <DeactivateButton id={it.id} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
