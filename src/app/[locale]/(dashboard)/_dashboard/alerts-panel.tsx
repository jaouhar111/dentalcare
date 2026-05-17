import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { DashboardAlert } from "@/server/actions/dashboard";

/**
 * Right-column alerts list. Each alert renders a colored card (rose/amber/cyan)
 * with an icon, headline + count, and a one-line detail. Clicking jumps to the
 * relevant page so the dentist can act on it.
 */
export async function AlertsPanel({ alerts }: { alerts: DashboardAlert[] }) {
  const t = await getTranslations("Dashboard.alerts");

  if (alerts.length === 0) {
    return (
      <div className="bg-emerald-50/40 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900 rounded-lg border p-4 text-center text-sm text-emerald-700 dark:text-emerald-300">
        {t("empty")}
      </div>
    );
  }

  return (
    <ul className="space-y-3 text-sm">
      {alerts.map((a) => {
        if (a.kind === "overdue-plans") {
          return (
            <AlertCard
              key={a.id}
              tone="rose"
              icon={<IconAlert />}
              href={"/invoices?status=OPEN"}
              title={t("overduePlans.title", { count: a.count })}
              detail={t("overduePlans.detail", {
                names: a.details.length ? a.details.join(", ") : "—",
              })}
            />
          );
        }
        if (a.kind === "low-stock") {
          return (
            <AlertCard
              key={a.id}
              tone="amber"
              icon={<IconBox />}
              href={"/stock?filter=low"}
              title={t("lowStock.title", { count: a.count })}
              detail={t("lowStock.detail", { names: a.details.join(", ") })}
            />
          );
        }
        if (a.kind === "recalls") {
          return (
            <AlertCard
              key={a.id}
              tone="primary"
              icon={<IconBell />}
              href={"/recalls"}
              title={t("recalls.title", { count: a.count })}
              detail={t("recalls.detail")}
            />
          );
        }
        return (
          <AlertCard
            key={a.id}
            tone="primary"
            icon={<IconBox />}
            href={"/invoices?status=OPEN"}
            title={t("openInvoices.title", { count: a.count })}
            detail={t("openInvoices.detail")}
          />
        );
      })}
    </ul>
  );
}

function AlertCard({
  tone,
  icon,
  href,
  title,
  detail,
}: {
  tone: "rose" | "amber" | "primary";
  icon: React.ReactNode;
  href: string;
  title: string;
  detail: string;
}) {
  const styles =
    tone === "rose"
      ? {
          bg: "bg-rose-50 border-rose-100 hover:bg-rose-100 dark:bg-rose-950/30 dark:border-rose-900",
          icon: "text-rose-600 dark:text-rose-400",
          title: "text-rose-900 dark:text-rose-200",
          detail: "text-rose-700 dark:text-rose-300",
        }
      : tone === "amber"
        ? {
            bg: "bg-amber-50 border-amber-100 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-900",
            icon: "text-amber-600 dark:text-amber-400",
            title: "text-amber-900 dark:text-amber-200",
            detail: "text-amber-700 dark:text-amber-300",
          }
        : {
            bg: "bg-primary/5 border-primary/20 hover:bg-primary/10",
            icon: "text-primary",
            title: "text-foreground",
            detail: "text-primary",
          };

  return (
    <li>
      <Link
        href={href as never}
        className={`flex items-start gap-3 rounded-lg border p-3 transition ${styles.bg}`}
      >
        <span className={`mt-0.5 ${styles.icon}`} aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className={`font-medium ${styles.title}`}>{title}</div>
          <div className={`mt-0.5 text-xs ${styles.detail}`}>{detail}</div>
        </div>
      </Link>
    </li>
  );
}

function IconAlert() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}
function IconBox() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31" />
    </svg>
  );
}
