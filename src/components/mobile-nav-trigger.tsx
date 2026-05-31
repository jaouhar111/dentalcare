"use client";

/**
 * Hamburger button that dispatches a `nav:open` window event. The
 * `MobileSidebarDrawer` listens for it and opens. Decoupling the
 * trigger from the drawer lets the topbar (server component) ship the
 * button without dragging in the drawer's React state.
 */
export function MobileNavTrigger({ ariaLabel }: { ariaLabel: string }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => window.dispatchEvent(new CustomEvent("nav:open"))}
      className="hover:bg-foreground/5 text-foreground/70 rounded-lg p-2 transition-colors md:hidden"
    >
      <svg
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
        />
      </svg>
    </button>
  );
}
