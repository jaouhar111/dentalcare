import { getTranslations, setRequestLocale } from "next-intl/server";
import { UserRole } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { listInvoices } from "@/server/actions/invoices";
import { requireRole } from "@/lib/auth/rbac";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
import { NumberedPagination } from "@/components/numbered-pagination";
import { NewInvoiceButton } from "./new-invoice-button";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type StatusFilter = "all" | "OPEN" | "DRAFT" | "PAID" | "VOID";

const FILTERS: StatusFilter[] = ["all", "OPEN", "DRAFT", "PAID", "VOID"];

export default async function InvoicesListPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: StatusFilter; q?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole([UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST]);
  const { status = "all", q = "", page: rawPage = "1" } = await searchParams;
  const t = await getTranslations("Invoices");

  const result = await listInvoices({
    status: FILTERS.includes(status) ? status : "all",
    query: q,
    page: Number(rawPage) || 1,
    pageSize: 25,
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

  const { items, total, page, pageSize } = result.data;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function buildHref(p: number) {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (q) params.set("q", q);
    params.set("page", String(p));
    return `/invoices?${params.toString()}`;
  }

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            <span className="num">{total}</span>{" "}
            {(status === "OPEN" ? t("subtitleOpen", { count: total }) : t("subtitle", { count: total })).replace(
              `${total} `,
              "",
            )}
          </p>
        </div>
        <NewInvoiceButton />
      </header>

      {/* Status tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const active = status === f;
          const params = new URLSearchParams();
          if (f !== "all") params.set("status", f);
          if (q) params.set("q", q);
          const href = params.toString() ? `/invoices?${params.toString()}` : "/invoices";
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
              {t(`tabs.${f}`)}
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
          <>
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground border-border/60 border-b text-xs tracking-wider uppercase">
                <tr>
                  <th className="px-4 py-3 text-start font-semibold">{t("columns.number")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("columns.patient")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("columns.issuedAt")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t("columns.dueDate")}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t("columns.total")}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t("columns.remaining")}</th>
                  <th className="px-4 py-3 text-center font-semibold">{t("columns.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-border/60 divide-y">
                {items.map((i) => (
                  <tr key={i.id} className="hover:bg-muted/30 group">
                    <td className="px-4 py-3">
                      <Link
                        href={`/invoices/${i.id}` as never}
                        className="group-hover:text-primary num font-mono text-xs font-semibold"
                      >
                        {i.number ?? t("noNumber")}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/patients/${i.patientId}` as never}
                        className="text-foreground hover:text-primary"
                      >
                        {i.patientName}
                      </Link>
                    </td>
                    <td className="num text-muted-foreground px-4 py-3 text-xs">
                      {i.emittedAt ? formatDateShort(i.emittedAt, locale as Locale) : "—"}
                    </td>
                    <td className="num text-muted-foreground px-4 py-3 text-xs">
                      {i.dueDate ? (
                        <span className={i.isOverdue ? "font-semibold text-rose-700" : ""}>
                          {formatDateShort(i.dueDate, locale as Locale)}
                          {i.isOverdue && ` · ${t("overdue")}`}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="num px-4 py-3 text-end font-medium">
                      {formatCurrency(i.total, locale as Locale)}
                    </td>
                    <td className="num px-4 py-3 text-end">
                      {i.remaining > 0 ? (
                        <span className="font-medium text-rose-700">
                          {formatCurrency(i.remaining, locale as Locale)}
                        </span>
                      ) : (
                        <span className="text-emerald-700">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={i.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
                <div className="text-muted-foreground">
                  <span className="num">
                    {from}–{to}
                  </span>{" "}
                  / <span className="num">{total}</span>
                </div>
                <NumberedPagination
                  current={page}
                  total={totalPages}
                  baseHref="/invoices"
                  buildHref={buildHref}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "DRAFT" | "EMITTED" | "PARTIAL" | "PAID" | "VOID" }) {
  const tone =
    status === "DRAFT"
      ? "bg-muted text-muted-foreground border-border"
      : status === "EMITTED"
        ? "bg-primary/10 text-primary border-primary/30"
        : status === "PARTIAL"
          ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
          : status === "PAID"
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
            : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900";
  // Inline t to avoid passing it as prop.
  return <BadgeI18n status={status} className={tone} />;
}

async function BadgeI18n({ status, className }: { status: string; className: string }) {
  const t = await getTranslations("Invoices.status");
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${className}`}
    >
      {t(status as "DRAFT")}
    </span>
  );
}
