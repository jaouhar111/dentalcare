"use client";

import { useTranslations } from "next-intl";
import type { DentalCondition, ToothSurface } from "@prisma/client";
import type { ToothState } from "@/server/actions/odontogram-types";
import {
  CONDITION_STYLE,
  EMPTY_TOOTH_COLOR,
  MANDIBULAR_LEFT,
  MANDIBULAR_RIGHT,
  MAXILLARY_LEFT,
  MAXILLARY_RIGHT,
  WHOLE_TOOTH_CONDITIONS,
  zoneSurfaces,
} from "./constants";

/**
 * SVG renderer of the 32 permanent FDI teeth. Each tooth is split into 5
 * clickable anatomical zones (vestibular, lingual, mesial, distal, and
 * occlusal/incisal centre). Surfaces store per-zone conditions, so a caries
 * on the occlusal of tooth 26 paints only that zone.
 *
 * Layout: 8 teeth per row × 2 rows (maxillary on top, mandibular on bottom)
 * with a dashed midline. Right side draws indices 18→11 / 48→41 left-to-right
 * (patient view — the dentist reads it like a chart in front of the patient).
 */
export function ChartSVG({
  state,
  selected,
  multiSelected,
  draftCondition,
  draftSurfaces,
  onSelect,
  onSelectSurface,
}: {
  state: Map<number, ToothState>;
  selected: number | null;
  multiSelected: ReadonlySet<number>;
  /// Condition currently set in the edit form — used to colour pending zones.
  draftCondition: DentalCondition | null;
  /// Surfaces currently checked in the edit form — overlaid as dashed
  /// outlines on the SVG so the dentist sees what they're about to commit.
  draftSurfaces: ReadonlySet<ToothSurface>;
  onSelect: (toothNumber: number) => void;
  onSelectSurface: (toothNumber: number, surface: ToothSurface) => void;
}) {
  const t = useTranslations("Odontogram.anatomy");

  const TOOTH_W = 36;
  const TOOTH_H = 48;
  const TOOTH_GAP = 4;
  const ROW_HEIGHT = TOOTH_H + 20;
  const COL = TOOTH_W + TOOTH_GAP;
  const ROW_WIDTH = 8 * COL - TOOTH_GAP;
  const GAP_X = 16;
  // Bumped from 40 → 88 so MAXILLAIRE / MANDIBULAIRE labels fit in the
  // left gutter without being clipped by the SVG viewBox.
  const PAD_X = 88;
  const TOP_PAD = 40;
  const ROW_GAP_Y = 80;

  const totalWidth = PAD_X * 2 + ROW_WIDTH * 2 + GAP_X;
  const totalHeight = TOP_PAD + ROW_HEIGHT * 2 + ROW_GAP_Y + 20;
  const midlineX = PAD_X + ROW_WIDTH + GAP_X / 2;

  function renderRow(teeth: readonly number[], xOffset: number, yOffset: number) {
    return teeth.map((n, i) => (
      <Tooth
        key={n}
        n={n}
        x={xOffset + i * COL}
        y={yOffset}
        w={TOOTH_W}
        h={TOOTH_H}
        state={state.get(n)}
        isSelected={selected === n}
        isMultiSelected={multiSelected.has(n)}
        draftCondition={selected === n ? draftCondition : null}
        draftSurfaces={selected === n ? draftSurfaces : EMPTY_SET}
        onClickTooth={onSelect}
        onClickSurface={onSelectSurface}
      />
    ));
  }

  const maxillaryY = TOP_PAD;
  const mandibularY = TOP_PAD + ROW_HEIGHT + ROW_GAP_Y - 20;

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      className="w-full select-none"
      role="group"
      aria-label="Odontogram"
    >
      {/* Anatomy labels */}
      <text x={midlineX - 90} y={18} textAnchor="end" fontSize="11" fontWeight="600" fill="#64748b">
        {t("right")}
      </text>
      <text x={midlineX + 90} y={18} textAnchor="start" fontSize="11" fontWeight="600" fill="#64748b">
        {t("left")}
      </text>
      <text
        x={PAD_X - 8}
        y={maxillaryY + TOOTH_H / 2 + 4}
        textAnchor="end"
        fontSize="10"
        fontWeight="600"
        fill="#0891b2"
      >
        {t("maxillary")}
      </text>
      <text
        x={PAD_X - 8}
        y={mandibularY + TOOTH_H / 2 + 4}
        textAnchor="end"
        fontSize="10"
        fontWeight="600"
        fill="#0891b2"
      >
        {t("mandibular")}
      </text>

      {/* Midline */}
      <line
        x1={midlineX}
        y1={TOP_PAD - 10}
        x2={midlineX}
        y2={totalHeight - 20}
        stroke="#cbd5e1"
        strokeDasharray="2 3"
        strokeWidth="1"
      />

      {/* Maxillary row */}
      {renderRow(MAXILLARY_RIGHT, PAD_X, maxillaryY)}
      {renderRow(MAXILLARY_LEFT, PAD_X + ROW_WIDTH + GAP_X, maxillaryY)}

      {/* Mandibular row */}
      {renderRow(MANDIBULAR_RIGHT, PAD_X, mandibularY)}
      {renderRow(MANDIBULAR_LEFT, PAD_X + ROW_WIDTH + GAP_X, mandibularY)}
    </svg>
  );
}

const EMPTY_SET: ReadonlySet<ToothSurface> = new Set();

/**
 * One tooth = 5 anatomical zones laid out as a cross:
 *
 *   ┌────────────────────────┐
 *   │           N (V)        │
 *   ├────┬──────────────┬────┤
 *   │ W  │              │ E  │
 *   │ M/D│      C       │ D/M│
 *   │    │  (O or I)    │    │
 *   ├────┴──────────────┴────┤
 *   │           S (L)        │
 *   └────────────────────────┘
 *
 * Click on a zone calls `onClickSurface(n, surface)`. Click anywhere else
 * (outside the inner rects) only triggers the tooth selection.
 */
function Tooth({
  n,
  x,
  y,
  w,
  h,
  state,
  isSelected,
  isMultiSelected,
  draftCondition,
  draftSurfaces,
  onClickTooth,
  onClickSurface,
}: {
  n: number;
  x: number;
  y: number;
  w: number;
  h: number;
  state: ToothState | undefined;
  isSelected: boolean;
  isMultiSelected: boolean;
  draftCondition: DentalCondition | null;
  draftSurfaces: ReadonlySet<ToothSurface>;
  onClickTooth: (n: number) => void;
  onClickSurface: (n: number, s: ToothSurface) => void;
}) {
  const zones = zoneSurfaces(n);

  // Saved (committed) colour for a given surface — derived from `state`.
  function savedColorFor(surface: ToothSurface): string {
    if (!state) return EMPTY_TOOTH_COLOR;
    const style = CONDITION_STYLE[state.condition];
    // Whole-tooth conditions paint every zone.
    if (WHOLE_TOOTH_CONDITIONS.has(state.condition)) return style.bg;
    // Surface-scoped condition but with no surfaces listed → fall back to
    // whole-tooth fill (covers legacy entries where the schema was looser).
    if (state.surfaces.length === 0) return style.bg;
    // For OCCLUSAL/INCISAL we treat them as the centre zone regardless of
    // which one was stored — the schema offers both, dentists may pick either.
    const centreSurfaces = new Set<ToothSurface>(["OCCLUSAL", "INCISAL"]);
    if (surface === zones.center) {
      return state.surfaces.some((s) => centreSurfaces.has(s)) ? style.bg : EMPTY_TOOTH_COLOR;
    }
    return state.surfaces.includes(surface) ? style.bg : EMPTY_TOOTH_COLOR;
  }

  // Draft overlay — light tint of the chosen condition over surfaces the
  // dentist has checked but not yet saved. Only shown when this tooth is
  // selected and the draft condition is surface-scoped.
  const draftStyle = draftCondition ? CONDITION_STYLE[draftCondition] : null;
  const draftIsWholeTooth = draftCondition
    ? WHOLE_TOOTH_CONDITIONS.has(draftCondition)
    : false;
  function draftOverlayFor(surface: ToothSurface): string | null {
    if (!draftStyle || draftIsWholeTooth) return null;
    if (surface === zones.center) {
      // Same OCCLUSAL/INCISAL equivalence as savedColorFor.
      const hasCentre =
        draftSurfaces.has("OCCLUSAL") || draftSurfaces.has("INCISAL");
      return hasCentre ? draftStyle.bg : null;
    }
    return draftSurfaces.has(surface) ? draftStyle.bg : null;
  }

  // Glyph painted at the centre when a saved condition exists.
  const savedStyle = state ? CONDITION_STYLE[state.condition] : null;
  const glyph = savedStyle?.glyph;
  const glyphColor =
    state && WHOLE_TOOTH_CONDITIONS.has(state.condition) ? "white" : "#64748b";

  // Zone rects.
  const z = {
    n: { x: 0, y: 0, w, h: h / 4, surface: zones.north },
    s: { x: 0, y: (3 * h) / 4, w, h: h / 4, surface: zones.south },
    w: { x: 0, y: h / 4, w: w / 4, h: h / 2, surface: zones.west },
    e: { x: (3 * w) / 4, y: h / 4, w: w / 4, h: h / 2, surface: zones.east },
    c: { x: w / 4, y: h / 4, w: w / 2, h: h / 2, surface: zones.center },
  };

  return (
    <g
      transform={`translate(${x},${y})`}
      role="group"
      aria-label={`Tooth ${n}${state ? `, ${state.condition}` : ""}`}
    >
      {(isSelected || isMultiSelected) && (
        <rect
          x={-3}
          y={-3}
          width={w + 6}
          height={h + 6}
          rx={8}
          fill="none"
          stroke={isSelected ? "#0891b2" : "#22d3ee"}
          strokeWidth={isSelected ? 3 : 2}
          strokeDasharray={isMultiSelected && !isSelected ? "3 2" : undefined}
        />
      )}

      {/* Background fill — gives the tooth a "frame" even before any zone is filled */}
      <rect x={0} y={0} width={w} height={h} rx={6} fill="#f8fafc" />

      {/* Zones — each one is independently clickable */}
      {(["n", "s", "w", "e", "c"] as const).map((key) => {
        const zone = z[key];
        const fill = savedColorFor(zone.surface);
        const draftFill = draftOverlayFor(zone.surface);
        return (
          <g key={key}>
            <rect
              x={zone.x}
              y={zone.y}
              width={zone.w}
              height={zone.h}
              fill={fill}
              stroke="#cbd5e1"
              strokeWidth={0.5}
              className="cursor-pointer transition hover:brightness-95"
              onClick={(e) => {
                e.stopPropagation();
                onClickSurface(n, zone.surface);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClickSurface(n, zone.surface);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Tooth ${n} ${zone.surface}`}
            >
              <title>{`${n} · ${zone.surface}`}</title>
            </rect>
            {draftFill && (
              <rect
                x={zone.x + 1}
                y={zone.y + 1}
                width={zone.w - 2}
                height={zone.h - 2}
                fill="none"
                stroke={draftFill}
                strokeWidth={1.5}
                strokeDasharray="2 1.5"
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}

      {/* Rounded corners — overlay a thin frame for the outer rect */}
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        rx={6}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={0.8}
        pointerEvents="none"
      />

      {/* Centre glyph */}
      {glyph && (
        <text
          x={w / 2}
          y={h / 2 + 5}
          textAnchor="middle"
          fontSize="14"
          fill={glyphColor}
          fontWeight="bold"
          pointerEvents="none"
        >
          {glyph}
        </text>
      )}

      {/* FDI number — clickable as a fallback for tooth-level selection */}
      <text
        x={w / 2}
        y={h + 14}
        textAnchor="middle"
        fontSize="10"
        fontWeight={isSelected ? 700 : 600}
        fill={isSelected ? "#0891b2" : "#64748b"}
        className="num cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onClickTooth(n);
        }}
      >
        {n}
      </text>
    </g>
  );
}
