import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en", "ar"] as const,
  defaultLocale: "fr",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

export const RTL_LOCALES: ReadonlySet<Locale> = new Set(["ar"]);

export function isRtl(locale: string): locale is "ar" {
  return RTL_LOCALES.has(locale as Locale);
}
