/**
 * "Print / PDF" toolbar button on the invoice detail page. Opens the real
 * PDF rendered server-side at `/api/invoices/[id]/pdf` in a new tab — the
 * browser's built-in PDF viewer handles print/download.
 */
export function PrintInvoiceButton({ id, label }: { id: string; label: string }) {
  return (
    <a
      href={`/api/invoices/${id}/pdf`}
      target="_blank"
      rel="noopener noreferrer"
      className="border-input hover:bg-muted bg-background text-foreground inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition"
    >
      <svg
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08"
        />
      </svg>
      {label}
    </a>
  );
}
