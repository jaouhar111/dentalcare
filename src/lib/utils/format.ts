import type { Locale } from "@/i18n/routing";

/**
 * Locale → BCP-47 tag used by Intl.* APIs.
 * Morocco-flavored: fr-MA / ar-MA so weekday names and number grouping match the cabinet's region.
 */
const INTL_LOCALE: Record<Locale, string> = {
  fr: "fr-MA",
  en: "en-US",
  ar: "ar-MA",
};

/**
 * Format a money amount in Moroccan Dirhams.
 *
 * fr → "1 500,00 DH"
 * en → "MAD 1,500.00"
 * ar → "1٬500٫00 د.م.‏"
 */
export function formatCurrency(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: "MAD",
    currencyDisplay: locale === "fr" ? "narrowSymbol" : "symbol",
  }).format(amount);
}

/**
 * Format a date with Moroccan conventions per locale.
 * Default style: "long" date (e.g. "13 mai 2026").
 */
export function formatDate(
  date: Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "long" },
): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], options).format(date);
}

/** Format a date + time, useful for appointments and timestamps. */
export function formatDateTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** Compact short format `dd/MM/yyyy` (fr/ar) or `MM/dd/yyyy` (en) — for table cells. */
export function formatDateShort(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "short" }).format(date);
}

/** Format a number with locale grouping (no currency). */
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

/** Compute age in completed years from a date of birth. */
export function ageInYears(dob: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return Math.max(0, age);
}
