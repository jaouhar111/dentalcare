import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { UserRole } from "@prisma/client";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles?: UserRole[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    title: "Pilotage",
    items: [
      {
        label: "Dashboard",
        href: "/",
        icon: "M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3",
      },
    ],
  },
  {
    title: "Patientèle",
    items: [
      {
        label: "Patients",
        href: "/patients",
        icon: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
      },
      {
        label: "Rendez-vous",
        href: "/appointments",
        icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25",
      },
      {
        label: "Liste d'attente",
        href: "/waitlist",
        icon: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292",
      },
      {
        label: "Factures",
        href: "/invoices",
        icon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z",
      },
      {
        label: "Stock",
        href: "/stock",
        icon: "M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z",
      },
      {
        label: "Rappels",
        href: "/recalls",
        icon: "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0",
      },
    ],
  },
  {
    title: "Cabinet",
    items: [
      {
        label: "Dentistes",
        href: "/dentists",
        icon: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z",
        roles: [UserRole.ADMIN],
      },
      {
        label: "Utilisateurs",
        href: "/users",
        icon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
        roles: [UserRole.ADMIN],
      },
      {
        label: "Traitements",
        href: "/settings/treatments",
        icon: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09z",
        roles: [UserRole.ADMIN],
      },
      {
        label: "Paramètres",
        href: "/settings",
        icon: "M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527a1.125 1.125 0 01-1.449-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.272-.806.107-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.764-.383.929-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894zM15 12a3 3 0 11-6 0 3 3 0 016 0z",
      },
      {
        label: "Registre d'audit",
        href: "/audit",
        icon: "M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z",
        roles: [UserRole.ADMIN],
      },
    ],
  },
];

export async function AppSidebar({ role }: { role: UserRole }) {
  const tNav = await getTranslations("Nav");

  return (
    <aside className="bg-card text-card-foreground border-border/60 hidden w-60 shrink-0 flex-col border-e md:flex">
      <Link
        href="/"
        className="border-border/60 hover:bg-muted/40 flex h-14 items-center gap-2 border-b px-4 transition"
      >
        <svg viewBox="0 0 64 64" className="text-primary h-7 w-7" fill="currentColor" aria-hidden>
          <path d="M32 5C22 5 14 10 12 21C10 32 13 42 17 51L19 56C20 58 23 58 24 56L26 49C27 46 29 44 32 44C35 44 37 46 38 49L40 56C41 58 44 58 45 56L47 51C51 42 54 32 52 21C50 10 42 5 32 5Z" />
        </svg>
        <span className="font-bold tracking-tight">
          Dental<span className="text-primary">Care</span>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto p-3 text-sm">
        {SECTIONS.map((section) => {
          const visibleItems = section.items.filter((it) => !it.roles || it.roles.includes(role));
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.title} className="mb-3">
              <div className="text-muted-foreground px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wider uppercase">
                {tNav(section.title as "Pilotage" | "Patientèle" | "Cabinet")}
              </div>
              {visibleItems.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className="text-foreground/80 hover:bg-muted/60 hover:text-foreground flex items-center gap-3 rounded-lg px-3 py-2 transition"
                >
                  <svg
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={it.icon} />
                  </svg>
                  {tNav(
                    it.label as
                      | "Dashboard"
                      | "Patients"
                      | "Rendez-vous"
                      | "Liste d'attente"
                      | "Factures"
                      | "Stock"
                      | "Rappels"
                      | "Dentistes"
                      | "Utilisateurs"
                      | "Traitements"
                      | "Paramètres"
                      | "Registre d'audit",
                  )}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
