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

// ─── Circular surface-map geometry ──────────────────────────────────────────
// Each tooth is a clean "surface wheel": a centre disc (occlusal / incisal)
// ringed by 4 annular sectors (vestibular, lingual, mesial, distal). White
// separators keep the surfaces legible without the old graph-paper grid.
const R_OUT = 15;
const R_IN = 6;

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** Annular-sector (ring segment) path between two radii and two angles. */
function ringSegment(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  a1: number,
  a2: number,
): string {
  const [x1o, y1o] = polar(cx, cy, rOut, a1);
  const [x2o, y2o] = polar(cx, cy, rOut, a2);
  const [x2i, y2i] = polar(cx, cy, rIn, a2);
  const [x1i, y1i] = polar(cx, cy, rIn, a1);
  const large = a2 - a1 > 180 ? 1 : 0;
  return `M ${x1o} ${y1o} A ${rOut} ${rOut} 0 ${large} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${rIn} ${rIn} 0 ${large} 0 ${x1i} ${y1i} Z`;
}

/**
 * One tooth = a circular surface map. SVG angles are clockwise from +x:
 *   top (vestibular) = 225°→315°, right = -45°→45°,
 *   bottom (lingual) = 45°→135°, left = 135°→225°, centre disc = occlusal.
 *
 * Surface-scoped conditions paint the relevant sector(s); whole-tooth
 * conditions fill the whole disc with a centred glyph. Clicking a sector
 * calls `onClickSurface(n, surface)`; the FDI number selects the tooth.
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
  const cx = w / 2;
  const cy = h / 2;

  // Saved (committed) colour for a given surface — derived from `state`.
  function savedColorFor(surface: ToothSurface): string {
    if (!state) return EMPTY_TOOTH_COLOR;
    const style = CONDITION_STYLE[state.condition];
    if (WHOLE_TOOTH_CONDITIONS.has(state.condition)) return style.bg;
    if (state.surfaces.length === 0) return style.bg;
    const centreSurfaces = new Set<ToothSurface>(["OCCLUSAL", "INCISAL"]);
    if (surface === zones.center) {
      return state.surfaces.some((s) => centreSurfaces.has(s)) ? style.bg : EMPTY_TOOTH_COLOR;
    }
    return state.surfaces.includes(surface) ? style.bg : EMPTY_TOOTH_COLOR;
  }

  // Draft overlay — dashed tint of the chosen condition over checked-but-not-
  // yet-saved surfaces. Only when this tooth is selected + surface-scoped.
  const draftStyle = draftCondition ? CONDITION_STYLE[draftCondition] : null;
  const draftIsWholeTooth = draftCondition
    ? WHOLE_TOOTH_CONDITIONS.has(draftCondition)
    : false;
  function draftOverlayFor(surface: ToothSurface): string | null {
    if (!draftStyle || draftIsWholeTooth) return null;
    if (surface === zones.center) {
      const hasCentre = draftSurfaces.has("OCCLUSAL") || draftSurfaces.has("INCISAL");
      return hasCentre ? draftStyle.bg : null;
    }
    return draftSurfaces.has(surface) ? draftStyle.bg : null;
  }

  const isWhole = state ? WHOLE_TOOTH_CONDITIONS.has(state.condition) : false;
  const wholeFill = state ? CONDITION_STYLE[state.condition].bg : null;
  const glyph = state ? CONDITION_STYLE[state.condition].glyph : undefined;

  // The 4 outer sectors (surface + sector path).
  const sectors: Array<{ key: string; surface: ToothSurface; d: string }> = [
    { key: "top", surface: zones.north, d: ringSegment(cx, cy, R_IN, R_OUT, 225, 315) },
    { key: "right", surface: zones.east, d: ringSegment(cx, cy, R_IN, R_OUT, -45, 45) },
    { key: "bottom", surface: zones.south, d: ringSegment(cx, cy, R_IN, R_OUT, 45, 135) },
    { key: "left", surface: zones.west, d: ringSegment(cx, cy, R_IN, R_OUT, 135, 225) },
  ];

  return (
    <g
      transform={`translate(${x},${y})`}
      role="group"
      aria-label={`Tooth ${n}${state ? `, ${state.condition}` : ""}`}
    >
      {/* Selection / multi-select ring */}
      {(isSelected || isMultiSelected) && (
        <circle
          cx={cx}
          cy={cy}
          r={R_OUT + 3}
          fill="none"
          stroke={isSelected ? "#0891b2" : "#22d3ee"}
          strokeWidth={isSelected ? 2.5 : 2}
          strokeDasharray={isMultiSelected && !isSelected ? "3 2" : undefined}
        />
      )}

      {isWhole && wholeFill ? (
        /* Whole-tooth condition — a single filled disc */
        <circle
          cx={cx}
          cy={cy}
          r={R_OUT}
          fill={wholeFill}
          stroke="white"
          strokeWidth={1.5}
          className="cursor-pointer transition hover:brightness-95"
          onClick={(e) => {
            e.stopPropagation();
            onClickTooth(n);
          }}
        >
          <title>{`${n} · ${state?.condition ?? ""}`}</title>
        </circle>
      ) : (
        <>
          {/* Outer sectors */}
          {sectors.map((s) => (
            <path
              key={s.key}
              d={s.d}
              fill={savedColorFor(s.surface)}
              stroke="white"
              strokeWidth={1}
              className="cursor-pointer transition hover:brightness-95"
              onClick={(e) => {
                e.stopPropagation();
                onClickSurface(n, s.surface);
              }}
              role="button"
              tabIndex={0}
              aria-label={`Tooth ${n} ${s.surface}`}
            >
              <title>{`${n} · ${s.surface}`}</title>
            </path>
          ))}
          {/* Centre disc */}
          <circle
            cx={cx}
            cy={cy}
            r={R_IN}
            fill={savedColorFor(zones.center)}
            stroke="white"
            strokeWidth={1}
            className="cursor-pointer transition hover:brightness-95"
            onClick={(e) => {
              e.stopPropagation();
              onClickSurface(n, zones.center);
            }}
            role="button"
            tabIndex={0}
            aria-label={`Tooth ${n} ${zones.center}`}
          >
            <title>{`${n} · ${zones.center}`}</title>
          </circle>
          {/* Draft overlays (dashed) */}
          {sectors.map((s) => {
            const d = draftOverlayFor(s.surface);
            return d ? (
              <path
                key={`draft-${s.key}`}
                d={s.d}
                fill="none"
                stroke={d}
                strokeWidth={1.5}
                strokeDasharray="2 1.5"
                pointerEvents="none"
              />
            ) : null;
          })}
          {(() => {
            const dc = draftOverlayFor(zones.center);
            return dc ? (
              <circle
                cx={cx}
                cy={cy}
                r={R_IN}
                fill="none"
                stroke={dc}
                strokeWidth={1.5}
                strokeDasharray="2 1.5"
                pointerEvents="none"
              />
            ) : null;
          })()}
        </>
      )}

      {/* Outer outline */}
      <circle
        cx={cx}
        cy={cy}
        r={R_OUT}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={0.8}
        pointerEvents="none"
      />

      {/* Whole-tooth glyph */}
      {isWhole && glyph && (
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fontSize="14"
          fill="white"
          fontWeight="bold"
          pointerEvents="none"
        >
          {glyph}
        </text>
      )}

      {/* FDI number — selects the tooth */}
      <text
        x={cx}
        y={cy + R_OUT + 13}
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
