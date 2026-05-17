import type { DentalCondition } from "@prisma/client";

/** FDI tooth order, mirroring the mockup. Reading order = left-to-right. */
export const MAXILLARY_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11] as const;
export const MAXILLARY_LEFT = [21, 22, 23, 24, 25, 26, 27, 28] as const;
export const MANDIBULAR_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41] as const;
export const MANDIBULAR_LEFT = [31, 32, 33, 34, 35, 36, 37, 38] as const;

export const ALL_TEETH: readonly number[] = [
  ...MAXILLARY_RIGHT,
  ...MAXILLARY_LEFT,
  ...MANDIBULAR_RIGHT,
  ...MANDIBULAR_LEFT,
] as const;

/**
 * Condition → visual styling. Colors are picked from the Tailwind palette to
 * stay consistent with the mockup and the rest of the app.
 *
 *   - `bg` is applied as the SVG `fill` and the legend swatch background.
 *   - `glyph` is rendered at the centre of the tooth — kept to one Unicode
 *     character so non-symbol fonts still render it correctly.
 */
export const CONDITION_STYLE: Record<
  DentalCondition,
  { bg: string; glyph: string; text: string }
> = {
  HEALTHY: { bg: "#10b981", glyph: "●", text: "#065f46" },
  CARIES: { bg: "#f43f5e", glyph: "▲", text: "#9f1239" },
  FILLING: { bg: "#0ea5e9", glyph: "■", text: "#075985" },
  CROWN: { bg: "#f59e0b", glyph: "◆", text: "#92400e" },
  IMPLANT: { bg: "#8b5cf6", glyph: "⬢", text: "#5b21b6" },
  MISSING: { bg: "#cbd5e1", glyph: "○", text: "#475569" },
  TO_EXTRACT: { bg: "#be123c", glyph: "✕", text: "#9f1239" },
  DEVITALIZED: { bg: "#64748b", glyph: "◐", text: "#334155" },
  FRACTURE: { bg: "#f97316", glyph: "⚡", text: "#9a3412" },
  PROSTHESIS: { bg: "#6366f1", glyph: "◢", text: "#3730a3" },
};

/** Conditions exposed in the legend / editor, in display order. */
export const CONDITIONS: readonly DentalCondition[] = [
  "HEALTHY",
  "CARIES",
  "FILLING",
  "CROWN",
  "IMPLANT",
  "MISSING",
  "TO_EXTRACT",
  "DEVITALIZED",
  "FRACTURE",
  "PROSTHESIS",
];

/** Default empty-tooth color (no DB entry yet). */
export const EMPTY_TOOTH_COLOR = "#e2e8f0";

/**
 * Conditions that affect the whole tooth, regardless of `surfaces`. For these
 * the SVG fills every zone with the condition color; the surfaces array is
 * ignored (and the schema requires it to be empty for HEALTHY).
 */
export const WHOLE_TOOTH_CONDITIONS: ReadonlySet<DentalCondition> = new Set<DentalCondition>([
  "HEALTHY",
  "MISSING",
  "IMPLANT",
  "TO_EXTRACT",
  "DEVITALIZED",
  "FRACTURE",
  "PROSTHESIS",
]);

/**
 * Surface assignments per zone of a tooth box.
 *
 * The center surface depends on tooth type (anterior vs posterior). The east
 * and west surfaces depend on which side of the dental arch (quadrants 1+4
 * on patient's right → mesial points toward midline = right side of box;
 * quadrants 2+3 → mesial = left side).
 */
export function zoneSurfaces(toothNumber: number): {
  north: "VESTIBULAR";
  south: "LINGUAL";
  east: "MESIAL" | "DISTAL";
  west: "MESIAL" | "DISTAL";
  center: "OCCLUSAL" | "INCISAL";
} {
  const quadrant = Math.floor(toothNumber / 10);
  const position = toothNumber % 10;
  // Incisors + canines (positions 1-3) are anterior → INCISAL; molars + premolars → OCCLUSAL.
  const center = position <= 3 ? "INCISAL" : "OCCLUSAL";
  // For quadrants 1+4 (patient's right half) the SVG mirrors so positions 8→1
  // are drawn left-to-right; mesial (toward midline) ends up on the RIGHT.
  // For quadrants 2+3 (patient's left half) mesial is on the LEFT.
  const mesialOnRight = quadrant === 1 || quadrant === 4;
  return {
    north: "VESTIBULAR",
    south: "LINGUAL",
    east: mesialOnRight ? "MESIAL" : "DISTAL",
    west: mesialOnRight ? "DISTAL" : "MESIAL",
    center,
  };
}
