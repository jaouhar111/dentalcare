/**
 * SVG donut chart for subscription-status distribution. No chart lib —
 * we compute the stroke-dasharray of a single circle per segment and
 * stack them with `transform: rotate`. Falls back to a single grey
 * ring when total is zero.
 */
export function StatusDonut({
  totals,
}: {
  totals: { trialing: number; active: number; pastDue: number; cancelled: number };
}) {
  const segments = [
    { key: "ACTIVE", label: "Actifs", value: totals.active, color: "#10b981" },
    { key: "TRIAL", label: "Essai", value: totals.trialing, color: "#f59e0b" },
    { key: "PAST_DUE", label: "Impayés", value: totals.pastDue, color: "#ef4444" },
    { key: "CANCELLED", label: "Annulés", value: totals.cancelled, color: "#64748b" },
  ];
  const total = segments.reduce((s, x) => s + x.value, 0);

  // SVG geometry — a 100×100 viewBox circle has circumference 2π·R.
  const R = 36;
  const C = 2 * Math.PI * R;

  if (total === 0) {
    return (
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 100 100" className="size-32">
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.15"
            strokeWidth="12"
          />
        </svg>
        <p className="text-muted-foreground text-sm">Aucun cabinet.</p>
      </div>
    );
  }

  let acc = 0;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 100 100" className="size-32 -rotate-90">
        {/* Background ring */}
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.08"
          strokeWidth="12"
        />
        {segments.map((s) => {
          if (s.value === 0) return null;
          const len = (s.value / total) * C;
          const offset = -acc;
          const dash = `${len} ${C - len}`;
          acc += len;
          return (
            <circle
              key={s.key}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="12"
              strokeDasharray={dash}
              strokeDashoffset={offset}
              strokeLinecap="butt"
            />
          );
        })}
        {/* Centered total */}
        <g transform="rotate(90 50 50)">
          <text
            x="50"
            y="48"
            textAnchor="middle"
            fontSize="18"
            fontWeight="700"
            fill="currentColor"
          >
            {total}
          </text>
          <text
            x="50"
            y="62"
            textAnchor="middle"
            fontSize="8"
            fill="currentColor"
            fillOpacity="0.6"
          >
            cabinets
          </text>
        </g>
      </svg>

      {/* Legend */}
      <ul className="space-y-1.5 text-[12px]">
        {segments.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span
                className="inline-block size-3 shrink-0 rounded-sm"
                style={{ background: s.color }}
              />
              <span className="text-foreground font-medium">{s.label}</span>
              <span className="text-muted-foreground num">
                {s.value} · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
