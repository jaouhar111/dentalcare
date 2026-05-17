"use client";

import { useTranslations } from "next-intl";
import type { MonthlyRevenuePoint } from "@/server/actions/dashboard";
import type { Locale } from "@/i18n/routing";

/**
 * 12-month revenue bar chart — pure CSS bars (no Recharts) so the cyan-200 →
 * cyan-800 gradient reads correctly toward the current month, matching the
 * `docs/mockups/dashboard.html` design.
 *
 * Tooltip text is the native browser `title=` attribute — works on hover
 * (desktop) and long-press (mobile) without any JS state.
 */
export function MonthlyRevenueChart({
  data,
  locale,
}: {
  data: MonthlyRevenuePoint[];
  locale: Locale;
}) {
  const t = useTranslations("Dashboard.months");
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 0,
  });

  // Cyan progression — older months lighter, current month darkest.
  const shades = [
    "bg-cyan-200 dark:bg-cyan-900",
    "bg-cyan-300 dark:bg-cyan-800",
    "bg-cyan-300 dark:bg-cyan-800",
    "bg-cyan-400 dark:bg-cyan-700",
    "bg-cyan-400 dark:bg-cyan-700",
    "bg-cyan-500 dark:bg-cyan-600",
    "bg-cyan-500 dark:bg-cyan-600",
    "bg-cyan-600 dark:bg-cyan-500",
    "bg-cyan-600 dark:bg-cyan-500",
    "bg-cyan-700 dark:bg-cyan-400",
    "bg-cyan-700 dark:bg-cyan-400",
    "bg-cyan-800 dark:bg-cyan-300",
  ];

  return (
    <div className="flex h-40 items-end gap-2 px-1">
      {data.map((d, i) => {
        const heightPct = Math.max(2, Math.round((d.value / max) * 100));
        return (
          <div key={d.key} className="flex flex-1 flex-col items-center">
            <div
              className={`w-full rounded-t transition-all ${shades[i] ?? "bg-cyan-500"}`}
              style={{ height: `${heightPct}%` }}
              title={`${t(String(d.monthIndex) as "0")} ${d.year} — ${fmt.format(d.value)}`}
            />
            <div
              className={`mt-1 text-[10px] ${
                d.isCurrent ? "text-primary font-semibold" : "text-muted-foreground"
              }`}
            >
              {t(String(d.monthIndex) as "0")}
            </div>
          </div>
        );
      })}
    </div>
  );
}
