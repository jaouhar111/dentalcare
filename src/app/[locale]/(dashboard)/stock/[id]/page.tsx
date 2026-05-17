import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StockMovementType, UserRole } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { getStockItem } from "@/server/actions/stock";
import { requireRole } from "@/lib/auth/rbac";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { StockItemFormDialog } from "../item-form";
import { MovementButton } from "../movement-button";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function StockItemDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const me = await requireRole([UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST]);
  const result = await getStockItem(id);
  if (!result.ok) notFound();
  const item = result.data;
  const t = await getTranslations("Stock");
  const canManage = me.role === UserRole.ADMIN;

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <Link
        href={"/stock" as never}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <svg
          className="size-4 rtl:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        {t("title")}
      </Link>

      <div className="bg-card border-border/60 mb-4 rounded-xl border p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="num text-muted-foreground font-mono text-xs">{item.code}</span>
              {item.category && (
                <span className="text-muted-foreground text-xs">· {item.category}</span>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{item.name}</h1>
            {item.description && (
              <p className="text-muted-foreground mt-1 text-sm">{item.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <MovementButton itemId={item.id} itemName={item.name} unit={item.unit} />
            {canManage && (
              <StockItemFormDialog
                mode="edit"
                item={{
                  id: item.id,
                  code: item.code,
                  name: item.name,
                  description: item.description,
                  unit: item.unit,
                  lowStockAt: item.lowStockAt,
                  expiresAt: item.expiresAt,
                  category: item.category,
                  isActive: item.isActive,
                }}
              />
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label={t("columns.quantity")}
            value={`${item.quantity} ${item.unit}`}
            tone={item.isOutOfStock ? "rose" : item.isLow ? "amber" : "default"}
          />
          {item.lowStockAt !== null && (
            <Stat label={t("form.lowStockAt")} value={String(item.lowStockAt)} />
          )}
          {item.expiresAt && (
            <Stat
              label={t("columns.expiresAt")}
              value={new Intl.DateTimeFormat(locale, {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(item.expiresAt)}
              tone={item.isExpired ? "rose" : item.isExpiringSoon ? "amber" : "default"}
            />
          )}
        </div>
      </div>

      <div className="bg-card border-border/60 overflow-hidden rounded-xl border">
        <div className="border-border/60 border-b px-5 py-3 text-sm font-semibold">
          {t("history.title")}
        </div>
        {item.movements.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm italic">
            {t("history.empty")}
          </p>
        ) : (
          <ul className="divide-border/60 divide-y">
            {item.movements.map((m) => {
              const isOut = m.quantity < 0;
              return (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      isOut
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    }`}
                  >
                    {isOut ? "↓" : "↑"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground font-medium">
                      {t(`type.${m.type}`)}
                      <span className="num text-muted-foreground ms-2 text-xs">
                        {m.quantity > 0 ? "+" : ""}
                        {m.quantity} {item.unit}
                      </span>
                      {m.unitPrice !== null && m.type === StockMovementType.PURCHASE && (
                        <span className="text-muted-foreground num ms-2 text-xs">
                          @ {formatCurrency(m.unitPrice, locale as Locale)}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground num text-xs">
                      {formatDate(m.recordedAt, locale as Locale, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · {m.recordedByName}
                    </div>
                    {m.note && <p className="text-foreground/70 mt-0.5 text-xs italic">{m.note}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "rose" | "amber";
}) {
  const color =
    tone === "rose"
      ? "text-rose-700 dark:text-rose-300"
      : tone === "amber"
        ? "text-amber-700 dark:text-amber-300"
        : "text-foreground";
  return (
    <div>
      <div className="text-muted-foreground text-xs uppercase tracking-wider">{label}</div>
      <div className={`num mt-0.5 text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
