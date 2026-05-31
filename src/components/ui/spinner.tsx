import { cn } from "@/lib/utils";

/**
 * Apple-style loading indicator — modelled after iOS UIActivityIndicatorView:
 * 12 rounded "blades" arranged radially, each one fading at a slightly
 * different phase of the rotation cycle. The result is the iconic
 * "wheel of light" you see in macOS / iOS — much more refined than the
 * generic CSS border-arc spinner.
 *
 * Pure SVG + CSS, no JS. Honours `prefers-reduced-motion` via the global
 * `*` rule in `globals.css`.
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
  const dim = size === "sm" ? 16 : size === "lg" ? 40 : 20;

  // 12 blades, evenly spaced by 30° around the origin. Each blade animates
  // its own opacity offset by 1/12s of the cycle so the highlight appears
  // to walk around the circle — that's the trick that makes it feel
  // "alive" rather than just spinning.
  const blades = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-3", className)}
    >
      <svg
        aria-hidden
        width={dim}
        height={dim}
        viewBox="0 0 24 24"
        className="apple-spinner shrink-0"
        style={{ color: "var(--accent-2, #0891b2)" }}
      >
        {blades.map((i) => (
          <rect
            key={i}
            // The blade is centred on the top of the circle then rotated
            // around the SVG origin. The CSS animation cycles each blade's
            // opacity from full to 25% over one revolution (1.1s).
            x="11"
            y="2"
            rx="1"
            ry="1"
            width="2"
            height="6"
            fill="currentColor"
            transform={`rotate(${i * 30} 12 12)`}
            style={{
              opacity: 0.25,
              animation: "apple-spin-blade 1.1s linear infinite",
              animationDelay: `${(-11 + i) * (1.1 / 12)}s`,
            }}
          />
        ))}
      </svg>
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
