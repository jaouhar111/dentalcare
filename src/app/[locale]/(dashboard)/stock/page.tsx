import { getTranslations, setRequestLocale } from "next-intl/server";
import { UserRole } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { listStockItems } from "@/server/actions/stock";
import { requireRole } from "@/lib/auth/rbac";
import { formatDateShort } from "@/lib/utils/format";
import { StockItemFormDialog } from "./item-form";
import { MovementButton } from "./movement-button";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type Filter = "all" | "low" | "out" | "expiring";
const FILTERS: Filter[] = ["all", "low", "out", "expiring"];

export default async function StockListPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filter?: Filter; inactive?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireRole([UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST]);
  const { filter = "all", inactive } = await searchParams;
  const t = await getTranslations("Stock");

  const result = await listStockItems({
    filter: FILTERS.includes(filter) ? filter : "all",
    includeInactive: inactive === "1",
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
  const items = result.data;
  const canManage = me.role === UserRole.ADMIN;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-2 lg:py-2">
      <header className="page-h1-row">
        <div>
          <h1 className="page-h1">{t("title")}</h1>
          <p className="page-sub">
            <span className="num">{items.length}</span>{" "}
            {t("subtitle", { count: items.length }).replace(`${items.length} `, "")}
          </p>
        </div>
        {canManage && <StockItemFormDialog mode="create" />}
      </header>

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const active = filter === f;
          const params = new URLSearchParams();
          if (f !== "all") params.set("filter", f);
          const href = params.toString() ? `/stock?${params.toString()}` : "/stock";
          return (
            <Link
              key={f}
              href={href as never}
              className={
                active
                  ? "bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-3 py-1.5 text-xs font-medium"
              }
            >
              {t(`filters.${f}`)}
            </Link>
          );
        })}
      </div>

      <div className="bg-card border-border/60 overflow-hidden rounded-xl border">
        {items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="text-foreground text-base font-medium">{t("empty")}</div>
            <p className="text-muted-foreground mt-1 text-sm">{t("emptyDesc")}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground border-border/60 border-b text-xs tracking-wider uppercase">
              <tr>
                <th className="px-4 py-3 text-start font-semibold">{t("columns.code")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("columns.name")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("columns.category")}</th>
                <th className="px-4 py-3 text-end font-semibold">{t("columns.quantity")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("columns.expiresAt")}</th>
                <th className="px-4 py-3 text-center font-semibold">{t("columns.status")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-muted/30 group">
                  <td className="px-4 py-3">
                    <Link
                      href={`/stock/${it.id}` as never}
                      className="num group-hover:text-primary font-mono text-xs font-semibold"
                    >
                      {it.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium">{it.name}</td>
                  <td className="text-muted-foreground px-4 py-3 text-xs">
                    {it.category ?? "—"}
                  </td>
                  <td className="num px-4 py-3 text-end">
                    <span
                      className={
                        it.isOutOfStock
                          ? "font-bold text-rose-700"
                          : it.isLow
                            ? "font-semibold text-amber-700"
                            : "text-foreground font-medium"
                      }
                    >
                      {it.quantity}
                    </span>
                    <span className="text-muted-foreground ms-1 text-xs">{it.unit}</span>
                  </td>
                  <td className="num text-muted-foreground px-4 py-3 text-xs">
                    {it.expiresAt ? (
                      <span
                        className={
                          it.isExpired
                            ? "font-semibold text-rose-700"
                            : it.isExpiringSoon
                              ? "font-medium text-amber-700"
                              : ""
                        }
                      >
                        {formatDateShort(it.expiresAt, locale as Locale)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge item={it} />
                  </td>
                  <td className="px-4 py-3 text-end">
                    <MovementButton itemId={it.id} itemName={it.name} unit={it.unit} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

async function StatusBadge({
  item,
}: {
  item: { isOutOfStock: boolean; isLow: boolean; isExpired: boolean; isExpiringSoon: boolean };
}) {
  const t = await getTranslations("Stock.badges");
  if (item.isOutOfStock) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
        ● {t("out")}
      </span>
    );
  }
  if (item.isLow) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
        ● {t("low")}
      </span>
    );
  }
  if (item.isExpired) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
        ⚠ {t("expired")}
      </span>
    );
  }
  if (item.isExpiringSoon) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
        ⏳ {t("expiringSoon")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
      ● {t("ok")}
    </span>
  );
}
