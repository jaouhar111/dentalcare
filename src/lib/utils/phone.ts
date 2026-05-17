/**
 * Normalize a phone number to Moroccan E.164 format (+212XXXXXXXXX).
 *
 * Accepted inputs:
 *  - "0612345678"   → "+212612345678"   (local with leading 0)
 *  - "612345678"    → "+212612345678"   (local without leading 0)
 *  - "212612345678" → "+212612345678"   (country code without +)
 *  - "+212612345678" → "+212612345678"  (already E.164)
 *  - "06 12 34 56 78" / "+212 6-12 34-56-78" → normalized (whitespace + dashes stripped)
 *
 * Returns `null` if the input cannot be normalized into a Moroccan mobile or
 * landline number (9 digits after country code).
 */
export function normalizeMoroccanPhone(raw: string): string | null {
  // Strip everything except digits and a leading "+".
  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (!cleaned) return null;

  let digits: string;
  if (cleaned.startsWith("+212")) {
    digits = cleaned.slice(4);
  } else if (cleaned.startsWith("212") && cleaned.length >= 12) {
    digits = cleaned.slice(3);
  } else if (cleaned.startsWith("0") && cleaned.length === 10) {
    digits = cleaned.slice(1);
  } else if (/^[1-9][0-9]{8}$/.test(cleaned)) {
    digits = cleaned;
  } else {
    return null;
  }

  if (!/^[1-9][0-9]{8}$/.test(digits)) {
    return null;
  }

  return `+212${digits}`;
}

/** Display phone in human-friendly Moroccan format `+212 6 12 34 56 78`. */
export function formatMoroccanPhone(e164: string): string {
  if (!e164.startsWith("+212") || e164.length !== 13) return e164;
  const digits = e164.slice(4);
  return `+212 ${digits[0]} ${digits.slice(1, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
}

/** Compact local Moroccan format used in tables: `0612-345-678`. */
export function formatMoroccanPhoneShort(e164: string): string {
  if (!e164.startsWith("+212") || e164.length !== 13) return e164;
  const digits = e164.slice(4);
  return `0${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
}
