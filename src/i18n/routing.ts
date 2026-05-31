import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en"] as const,
  defaultLocale: "fr",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

/**
 * Arabic was dropped after V1: maintaining 3 translations was 50% of
 * the i18n cost for ~5% of cabinets that asked for it. Kept the
 * `RTL_LOCALES` helper for future re-introduction (Hebrew, etc.).
 */
export const RTL_LOCALES: ReadonlySet<Locale> = new Set([]);

export function isRtl(locale: string): boolean {
  return RTL_LOCALES.has(locale as Locale);
}
