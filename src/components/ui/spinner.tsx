import { cn } from "@/lib/utils";

/**
 * Lightweight loading indicator. Three sizes + optional label.
 *
 * Used by Next.js `loading.tsx` files (route-level suspense) and inline
 * during async actions inside Client Components. Pure CSS — no JS needed.
 *
 * @example
 *   <Spinner />                          // 20px, no label
 *   <Spinner size="lg" label="Chargement…" />
 */
export function Spinner({
  size = "md",
  label,
  className,
}: {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}) {
  const dim = size === "sm" ? "size-4" : size === "lg" ? "size-10" : "size-5";
  const stroke = size === "lg" ? "border-4" : "border-2";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-3", className)}
    >
      <span
        aria-hidden
        className={cn(
          // Solid primary-colored ring with a transparent top quarter →
          // rotating arc effect. Inline style keeps tailwind-merge from
          // collapsing the two `border-*` color utilities into one.
          "inline-block animate-spin rounded-full",
          dim,
          stroke,
        )}
        style={{ borderColor: "var(--primary, #06b6d4)", borderTopColor: "transparent" }}
      />
      {label ? <span className="text-muted-foreground text-sm font-medium">{label}</span> : null}
      {!label && <span className="sr-only">Chargement</span>}
    </div>
  );
}

/**
 * Centered full-page spinner — used as the default `loading.tsx` body.
 */
export function PageSpinner({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner size="lg" label={label} />
    </div>
  );
}
