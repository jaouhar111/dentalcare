/**
 * Wraps the case-insensitive matches of `query` inside `text` with a
 * highlighted `<mark>`. Pure rendering, server-safe.
 */
export function HighlightMatch({
  text,
  query,
  className,
}: {
  text: string;
  query: string;
  className?: string;
}) {
  if (!query.trim()) return <span className={className}>{text}</span>;

  const q = query.trim().toLowerCase();
  const lower = text.toLowerCase();
  const parts: Array<{ value: string; match: boolean }> = [];
  let from = 0;
  let i = lower.indexOf(q, from);
  while (i !== -1) {
    if (i > from) parts.push({ value: text.slice(from, i), match: false });
    parts.push({ value: text.slice(i, i + q.length), match: true });
    from = i + q.length;
    i = lower.indexOf(q, from);
  }
  if (from < text.length) parts.push({ value: text.slice(from), match: false });

  return (
    <span className={className}>
      {parts.map((p, idx) =>
        p.match ? (
          <mark
            key={idx}
            className="rounded-sm bg-amber-100 px-0.5 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
          >
            {p.value}
          </mark>
        ) : (
          <span key={idx}>{p.value}</span>
        ),
      )}
    </span>
  );
}
