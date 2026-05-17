import type { TopTreatment } from "@/server/actions/dashboard";

/**
 * Horizontal bar list of top 5 treatments by count, matching the mockup —
 * label left, percentage right, full-width track underneath with the bar
 * fading lighter for less-popular acts.
 */
export function TopTreatmentsList({ items }: { items: TopTreatment[] }) {
  const shades = [
    "bg-cyan-600",
    "bg-cyan-500",
    "bg-cyan-400",
    "bg-cyan-300",
    "bg-cyan-200",
  ];
  return (
    <ul className="space-y-3 text-sm">
      {items.map((t, i) => (
        <li key={t.code}>
          <div className="mb-1 flex justify-between">
            <span className="text-foreground">{t.name}</span>
            <span className="text-muted-foreground num">{t.pct} %</span>
          </div>
          <div className="bg-muted h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-1.5 rounded-full ${shades[i] ?? "bg-cyan-200"}`}
              style={{ width: `${Math.max(2, t.pct)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
