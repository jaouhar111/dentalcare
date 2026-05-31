import { setRequestLocale } from "next-intl/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/rbac";
import { getPlatformUsers } from "@/server/actions/super-admin-users";

export const dynamic = "force-dynamic";

export default async function SuperAdminUsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole([UserRole.SUPER_ADMIN]);

  const result = await getPlatformUsers();
  if (!result.ok) {
    return (
      <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
        {result.error.message}
      </div>
    );
  }
  const users = result.data;

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const dateTimeFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const byRole = {
    SUPER_ADMIN: users.filter((u) => u.role === "SUPER_ADMIN").length,
    ADMIN: users.filter((u) => u.role === "ADMIN").length,
    DENTIST: users.filter((u) => u.role === "DENTIST").length,
    RECEPTIONIST: users.filter((u) => u.role === "RECEPTIONIST").length,
  };

  return (
    <div className="mx-auto w-full max-w-7xl">
      <header className="page-h1-row">
        <div>
          <h1 className="page-h1">Utilisateurs</h1>
          <p className="page-sub">
            <span className="num">{users.length}</span> comptes ·{" "}
            {byRole.SUPER_ADMIN} super-admin · {byRole.ADMIN} admins · {byRole.DENTIST} dentistes
            · {byRole.RECEPTIONIST} réceptionnistes
          </p>
        </div>
      </header>

      <section className="apple-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-muted-foreground border-border/60 border-b text-[10px] font-bold tracking-wider uppercase">
                <th className="py-2 pr-3">Nom</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Rôle</th>
                <th className="py-2 pr-3">Cabinet</th>
                <th className="py-2 pr-3">Statut</th>
                <th className="py-2 pr-3">Dernier login</th>
                <th className="py-2 pr-3">Créé</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-border/40 border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{u.fullName}</td>
                  <td className="text-muted-foreground py-2 pr-3 text-[11px]">{u.email}</td>
                  <td className="py-2 pr-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="py-2 pr-3">
                    <div className="text-[12px]">{u.clinicName}</div>
                    <div className="text-muted-foreground font-mono text-[10px]">
                      {u.clinicSlug}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    {u.isActive ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                        Actif
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                        Désactivé
                      </span>
                    )}
                  </td>
                  <td className="text-muted-foreground py-2 pr-3 text-[11px]">
                    {u.lastLoginAt ? dateTimeFmt.format(u.lastLoginAt) : "—"}
                  </td>
                  <td className="text-muted-foreground py-2 pr-3 text-[11px]">
                    {dateFmt.format(u.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const map: Record<UserRole, { label: string; cls: string }> = {
    SUPER_ADMIN: { label: "Super-admin", cls: "bg-amber-500/20 text-amber-800 dark:text-amber-200" },
    ADMIN: { label: "Admin", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
    DENTIST: {
      label: "Dentiste",
      cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    },
    RECEPTIONIST: {
      label: "Réceptionniste",
      cls: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    },
  };
  const { label, cls } = map[role];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}
