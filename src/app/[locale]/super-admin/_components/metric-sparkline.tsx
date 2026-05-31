import type { DailyCountSeries } from "@/server/actions/super-admin-types";

/**
 * 30-day daily-count sparkline. SVG-only, no chart lib — the platform
 * dashboard renders 3 of these in the same page so we want them cheap
 * + DOM-light. Rounded bars, gradient configurable per metric, count
 * label on top of each non-zero bar.
 *
 * Accepts a `color` pair to drive the gradient — keeps the visual
 * vocabulary (amber for owner metrics, emerald for clinical, sky for
 * AI) without forking the component.
 */
export function MetricSparkline({
  points,
  color = "amber",
  ariaLabel,
}: {
  points: DailyCountSeries;
  color?: "amber" | "emerald" | "sky";
  ariaLabel?: string;
}) {
  if (points.length === 0) {
    return <p className="text-muted-foreground text-sm">Pas encore de données.</p>;
  }
  const max = Math.max(1, ...points.map((p) => p.count));
  const W = 600;
  const H = 160;
  const PAD_X = 6;
  const PAD_Y = 18;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;
  const barW = innerW / points.length - 6;
  const total = points.reduce((s, p) => s + p.count, 0);

  // Per-color gradient stops. The id is namespaced by color so multiple
  // sparklines on the same page don't collide via the SVG defs lookup.
  const gradients: Record<typeof color, [string, string]> = {
    amber: ["#f59e0b", "#b45309"],
    emerald: ["#10b981", "#047857"],
    sky: ["#0ea5e9", "#0369a1"],
  };
  const [stopFrom, stopTo] = gradients[color];
  const gid = `bar-${color}`;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-[160px] w-full"
        role="img"
        aria-label={ariaLabel ?? `30 day metric — ${total}`}
      >
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={H - PAD_Y}
          y2={H - PAD_Y}
          stroke="currentColor"
          strokeOpacity="0.1"
          strokeWidth="1"
        />
        {points.map((p, i) => {
          const x = PAD_X + i * (innerW / points.length);
          const h = (p.count / max) * innerH;
          const y = H - PAD_Y - h;
          return (
            <g key={p.day}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(2, h)}
                rx="3"
                fill={p.count > 0 ? `url(#${gid})` : "currentColor"}
                fillOpacity={p.count > 0 ? 1 : 0.06}
              />
              {p.count > 0 ? (
                <text
                  x={x + barW / 2}
                  y={y - 4}
                  textAnchor="middle"
                  fontSize="9"
                  fill="currentColor"
                  fillOpacity="0.7"
                >
                  {p.count}
                </text>
              ) : null}
            </g>
          );
        })}
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stopFrom} />
            <stop offset="100%" stopColor={stopTo} />
          </linearGradient>
        </defs>
      </svg>
      <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
        <span>{points[0]?.day.slice(5).replace("-", "/")}</span>
        <span>{points[points.length - 1]?.day.slice(5).replace("-", "/")}</span>
      </div>
    </div>
  );
}
