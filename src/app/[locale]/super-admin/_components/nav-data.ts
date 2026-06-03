/**
 * Sidebar nav for the platform-owner area. Five sections, owner-only.
 * Mirrors the cabinet `nav-data.ts` shape so the sidebar component is
 * dumb and shareable.
 */
export interface SaNavItem {
  label: string;
  href: string;
  /// SVG path data inside a 24×24 stroked icon.
  icon: string;
}

export const SA_NAV: SaNavItem[] = [
  {
    label: "Tableau de bord",
    href: "/super-admin",
    icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M3 7l9-4 9 4M3 7h18",
  },
  {
    label: "Cabinets",
    href: "/super-admin/clinics",
    icon: "M3 21h18M5 21V7l7-4 7 4v14M9 21V12h6v9",
  },
  {
    label: "Abonnements",
    href: "/super-admin/subscriptions",
    icon: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z",
  },
  {
    label: "Business Intelligence",
    href: "/super-admin/business-intelligence",
    icon: "M9 17V7m4 10V11m4 6V4M3 21h18",
  },
  {
    label: "Support",
    href: "/super-admin/support",
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.85L3 21l1.97-3.94A8.97 8.97 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  },
  {
    label: "Monitoring IA",
    href: "/super-admin/monitoring",
    icon: "M3 13h2l3-8 4 16 3-8h6",
  },
  {
    label: "Utilisateurs",
    href: "/super-admin/users",
    icon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
  },
  {
    label: "Registre d'audit",
    href: "/super-admin/audit",
    icon: "M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z",
  },
];
