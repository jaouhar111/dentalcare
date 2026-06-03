import type { NoShowRiskAssessment } from "@/server/actions/no-show-risk";

/**
 * Phase 11 — Stage E
 *
 * Reusable risk badge. Three flavours :
 *   - HIGH : red, "⚠ 2 no-shows"
 *   - LOW  : amber, "↺ 1 no-show"
 *   - NONE : nothing rendered (returns null)
 *
 * The `tooltip` is the cabinet-facing suggestion ("ask for a deposit",
 * "send a 48h pre-confirmation"). Bind it to `title` for now; a richer
 * popover lands once we have a shared tooltip primitive.
 */
export function NoShowRiskBadge({
  assessment,
  size = "sm",
}: {
  assessment: Pick<
    NoShowRiskAssessment,
    "level" | "noShowCount12m" | "cancelledLateCount12m" | "suggestion"
  >;
  size?: "xs" | "sm" | "md";
}) {
  if (assessment.level === "NONE") return null;

  const isHigh = assessment.level === "HIGH";
  const sizeClass =
    size === "xs"
      ? "px-1.5 py-0.5 text-[10px]"
      : size === "md"
        ? "px-2.5 py-1 text-[12px]"
        : "px-2 py-0.5 text-[11px]";

  const cls = isHigh
    ? "bg-red-500/12 text-red-700 ring-red-500/20 dark:text-red-300"
    : "bg-amber-500/12 text-amber-700 ring-amber-500/20 dark:text-amber-300";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ring-1 ${sizeClass} ${cls}`}
      title={assessment.suggestion ?? undefined}
      role="status"
    >
      {isHigh ? "⚠" : "↺"}
      <span className="tabular-nums">
        {assessment.noShowCount12m} no-show
        {assessment.noShowCount12m > 1 ? "s" : ""}
        {assessment.cancelledLateCount12m > 0 ? ` · ${assessment.cancelledLateCount12m} annul. tardive` : ""}
      </span>
    </span>
  );
}
