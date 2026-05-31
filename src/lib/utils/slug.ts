/**
 * Converts an arbitrary string to a URL-safe ASCII slug:
 *  - Unicode NFD normalize → strip diacritics ("é" → "e")
 *  - Lower-case
 *  - Replace any non-alphanumeric run with a single dash
 *  - Trim dashes from both ends
 *  - Empty result → "clinic" so we never return ""
 *
 * Used at signup to derive `Clinic.slug` from the cabinet name. The
 * caller resolves uniqueness by appending a numeric suffix if needed.
 */
export function slugify(input: string): string {
  const s = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > 0 ? s.slice(0, 60) : "clinic";
}
