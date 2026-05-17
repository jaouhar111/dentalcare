"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { useTransition } from "react";

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="ring-border/60 bg-muted/40 inline-flex items-center gap-0.5 rounded-md p-0.5 ring-1"
    >
      {routing.locales.map((l: Locale) => {
        const isActive = locale === l;
        return (
          <button
            key={l}
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(() => {
                router.replace(pathname, { locale: l });
              });
            }}
            className={`rounded px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {l === "fr" ? "FR" : l === "en" ? "EN" : "ع"}
          </button>
        );
      })}
    </div>
  );
}
