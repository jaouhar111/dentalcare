import { Link } from "@/i18n/navigation";

/**
 * Build a pagination range with ellipses around the current page.
 * Examples:
 *   total=49, current=1  → [1, 2, 3, "…", 49]
 *   total=49, current=5  → [1, "…", 4, 5, 6, "…", 49]
 *   total=49, current=49 → [1, "…", 47, 48, 49]
 */
function paginationRange(current: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const range: Array<number | "…"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) range.push("…");
  for (let i = start; i <= end; i++) range.push(i);
  if (end < total - 1) range.push("…");
  range.push(total);
  return range;
}

export function NumberedPagination({
  current,
  total,
  baseHref,
  buildHref,
}: {
  current: number;
  total: number;
  /** Base path (e.g. `/patients`). */
  baseHref: string;
  /** Build the URL for a given page (uses URLSearchParams of caller). */
  buildHref: (page: number) => string;
}) {
  const items = paginationRange(current, total);
  const prevDisabled = current <= 1;
  const nextDisabled = current >= total;

  return (
    <div className="flex items-center gap-1">
      <ArrowLink
        disabled={prevDisabled}
        href={buildHref(current - 1)}
        label="Previous"
        direction="prev"
      />
      {items.map((it, idx) =>
        it === "…" ? (
          <span key={`gap-${idx}`} className="text-muted-foreground px-2">
            …
          </span>
        ) : (
          <PageButton key={it} page={it} active={it === current} href={buildHref(it)} />
        ),
      )}
      <ArrowLink
        disabled={nextDisabled}
        href={buildHref(current + 1)}
        label="Next"
        direction="next"
      />
    </div>
  );

  // baseHref isn't read directly (callers already use buildHref) — kept for future API symmetry.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  baseHref;
}

function PageButton({ page, active, href }: { page: number; active: boolean; href: string }) {
  if (active) {
    return (
      <span
        aria-current="page"
        className="bg-primary text-primary-foreground num grid size-8 place-items-center rounded font-medium"
      >
        {page}
      </span>
    );
  }
  return (
    <Link
      href={href as never}
      className="text-foreground hover:bg-muted num grid size-8 place-items-center rounded font-medium"
    >
      {page}
    </Link>
  );
}

function ArrowLink({
  disabled,
  href,
  label,
  direction,
}: {
  disabled: boolean;
  href: string;
  label: string;
  direction: "prev" | "next";
}) {
  const path = direction === "prev" ? "M15.75 19.5L8.25 12l7.5-7.5" : "M8.25 4.5l7.5 7.5-7.5 7.5";

  if (disabled) {
    return (
      <span
        aria-disabled
        className="text-muted-foreground/50 grid size-8 place-items-center rounded"
      >
        <svg
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={path} />
        </svg>
      </span>
    );
  }
  return (
    <Link
      href={href as never}
      aria-label={label}
      className="text-muted-foreground hover:bg-muted grid size-8 place-items-center rounded"
    >
      <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
    </Link>
  );
}
