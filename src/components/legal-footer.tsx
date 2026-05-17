import { Link } from "@/i18n/navigation";

/**
 * Compact footer linking to legal pages — required on every page where a
 * user can interact with patient data (loi 09-08 art. 5 informs that the
 * patient must know how to reach the privacy policy).
 *
 * Two variants:
 *   - `inline`: small horizontal strip suitable for dashboard layout
 *     (sits at the bottom of the main scrollable area).
 *   - `centered`: stacked variant for full-screen auth pages (login,
 *     forgot-password, reset-password).
 */
export function LegalFooter({ variant = "inline" }: { variant?: "inline" | "centered" }) {
  const links = (
    <>
      <Link
        href={"/legal/mentions-legales" as never}
        className="text-muted-foreground hover:text-foreground"
      >
        Mentions légales
      </Link>
      <Link
        href={"/legal/privacy" as never}
        className="text-muted-foreground hover:text-foreground"
      >
        Confidentialité
      </Link>
      <Link
        href={"/legal/cgu" as never}
        className="text-muted-foreground hover:text-foreground"
      >
        CGU
      </Link>
    </>
  );

  if (variant === "centered") {
    return (
      <footer className="mt-8 flex flex-col items-center gap-2 text-xs">
        <div className="flex flex-wrap justify-center gap-4">{links}</div>
        <p className="text-muted-foreground">
          © {new Date().getFullYear()} DentalCare
        </p>
      </footer>
    );
  }

  return (
    <footer className="border-border/40 text-muted-foreground mt-auto flex flex-wrap items-center justify-between gap-3 border-t px-6 py-3 text-xs">
      <span>© {new Date().getFullYear()} DentalCare</span>
      <div className="flex gap-4">{links}</div>
    </footer>
  );
}
