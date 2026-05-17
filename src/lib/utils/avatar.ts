/**
 * Deterministic Tailwind color classes for an avatar bubble, based on a name.
 * Same name always renders the same color — feels personal and consistent
 * without storing anything per-patient.
 */

type ColorTuple = { bg: string; text: string };

const PALETTE: ColorTuple[] = [
  { bg: "bg-cyan-100 dark:bg-cyan-950/40", text: "text-cyan-700 dark:text-cyan-300" },
  { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300" },
  { bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-violet-100 dark:bg-violet-950/40", text: "text-violet-700 dark:text-violet-300" },
  { bg: "bg-sky-100 dark:bg-sky-950/40", text: "text-sky-700 dark:text-sky-300" },
  { bg: "bg-rose-100 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300" },
  { bg: "bg-indigo-100 dark:bg-indigo-950/40", text: "text-indigo-700 dark:text-indigo-300" },
  { bg: "bg-teal-100 dark:bg-teal-950/40", text: "text-teal-700 dark:text-teal-300" },
];

/** djb2-style hash → palette index. Stable across server/client. */
function hashName(name: string): number {
  let h = 5381;
  for (let i = 0; i < name.length; i++) {
    h = (h * 33) ^ name.charCodeAt(i);
  }
  return Math.abs(h);
}

export function avatarColor(name: string): ColorTuple {
  return PALETTE[hashName(name) % PALETTE.length]!;
}

/** Two-letter initials (first + last). Falls back to first char of name or "?". */
export function initialsOf(firstName: string, lastName: string): string {
  return ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase() || "?";
}
