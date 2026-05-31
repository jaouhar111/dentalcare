import { getTranslations, setRequestLocale } from "next-intl/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/rbac";
import { listUsers } from "@/server/actions/users";
import { formatDate } from "@/lib/utils/format";
import { avatarColor, initialsOf } from "@/lib/utils/avatar";
import { UserFormDialog } from "./user-form";
import { ResetPasswordButton } from "./reset-password-button";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireRole([UserRole.ADMIN]);
  const t = await getTranslations("Users");

  const result = await listUsers();
  if (!result.ok) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {result.error.message}
        </div>
      </div>
    );
  }
  const users = result.data;
  const activeCount = users.filter((u) => u.isActive).length;

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <header className="page-h1-row">
        <div>
          <h1 className="page-h1">{t("title")}</h1>
          <p className="page-sub">
            <span className="num">{activeCount}</span>{" "}
            {t("subtitle", { count: activeCount }).replace(`${activeCount} `, "")}
          </p>
        </div>
        <UserFormDialog mode="create" />
      </header>

      <div className="bg-card border-border/60 overflow-hidden rounded-xl border">
        {users.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-foreground text-base font-medium">{t("empty")}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground border-border/60 border-b text-xs tracking-wider uppercase">
              <tr>
                <th className="px-4 py-3 text-start font-semibold">{t("columns.name")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("columns.email")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("columns.role")}</th>
                <th className="px-4 py-3 text-start font-semibold">{t("columns.lastLogin")}</th>
                <th className="px-4 py-3 text-center font-semibold">{t("columns.status")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {users.map((u) => {
                const color = avatarColor(u.fullName);
                const isMe = u.id === me.id;
                return (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${color.bg} ${color.text}`}
                          aria-hidden
                        >
                          {initialsOf(
                            u.fullName.split(" ")[0] ?? "",
                            u.fullName.split(" ")[1] ?? "",
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium">
                            {u.fullName}
                            {isMe && (
                              <span className="text-muted-foreground ms-1 text-xs">(toi)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-muted-foreground num px-4 py-3 text-xs">{u.email}</td>
                    <td className="text-foreground px-4 py-3 text-sm">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="num text-muted-foreground px-4 py-3 text-xs">
                      {u.lastLoginAt
                        ? formatDate(u.lastLoginAt, locale as Locale, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : t("neverLoggedIn")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                          ● {t("active")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground border-border bg-muted inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                          ● {t("inactive")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex justify-end gap-1">
                        <UserFormDialog mode="edit" user={u} />
                        <ResetPasswordButton id={u.id} email={u.email} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

async function RoleBadge({ role }: { role: UserRole }) {
  const t = await getTranslations("Users.roles");
  const tone =
    role === UserRole.ADMIN
      ? "bg-primary/10 text-primary border-primary/30"
      : role === UserRole.DENTIST
        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${tone}`}>
      {t(role)}
    </span>
  );
}
