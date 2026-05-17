"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { UserRole } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createUser, updateUser } from "@/server/actions/users";
import type { UserListItem } from "@/server/actions/users-types";

const ROLES: UserRole[] = [UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTIONIST];

/**
 * Combined create/edit dialog for users. In edit mode the email is read-only
 * (changing the email amounts to provisioning a new identity — admin should
 * deactivate + recreate instead). Password is set separately via the
 * `ResetPasswordButton`.
 */
export function UserFormDialog(
  props: { mode: "create" } | { mode: "edit"; user: UserListItem },
) {
  const t = useTranslations("Users");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isEdit = props.mode === "edit";
  const user = isEdit ? props.user : null;

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<UserRole>(user?.role ?? UserRole.RECEPTIONIST);
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(user?.isActive ?? true);

  function reset() {
    if (isEdit && user) {
      setFullName(user.fullName);
      setEmail(user.email);
      setRole(user.role);
      setIsActive(user.isActive);
    } else {
      setFullName("");
      setEmail("");
      setRole(UserRole.RECEPTIONIST);
      setPassword("");
      setIsActive(true);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = isEdit
        ? await updateUser({ id: user!.id, fullName, role, isActive })
        : await createUser({ fullName, email, role, password, isActive });
      if (!res.ok) {
        const known = [
          "DUPLICATE_EMAIL",
          "INVALID_EMAIL",
          "PASSWORD_TOO_SHORT",
          "LAST_ADMIN",
        ] as const;
        const msg = (known as readonly string[]).includes(res.error.code)
          ? t(`errors.${res.error.code as "DUPLICATE_EMAIL"}`)
          : res.error.message;
        toast.error(tToast("error"), { description: msg });
        return;
      }
      toast.success(isEdit ? t("toast.updated") : t("toast.created"));
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {isEdit ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            reset();
            setOpen(true);
          }}
          className="h-8 px-2 text-xs"
        >
          {t("edit")}
        </Button>
      ) : (
        <Button type="button" onClick={() => setOpen(true)} className="gap-1.5">
          <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t("add")}
        </Button>
      )}

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t(isEdit ? "form.titleEdit" : "form.titleCreate")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                {t("form.fullName")} *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                maxLength={120}
                disabled={isPending}
                className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                {t("form.email")} *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isPending || isEdit}
                className="border-input bg-background num w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                {t("form.role")} *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                disabled={isPending}
                className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </select>
            </div>
            {!isEdit && (
              <div>
                <label className="text-foreground mb-1 block text-xs font-medium">
                  {t("form.password")} *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={128}
                  disabled={isPending}
                  className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
                />
                <p className="text-muted-foreground mt-1 text-xs">{t("form.passwordHint")}</p>
              </div>
            )}
            <label className="hover:bg-muted/40 flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={isPending}
              />
              <span className="text-foreground font-medium">{t("form.isActive")}</span>
            </label>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                {t("form.cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? t("form.submitting")
                  : isEdit
                    ? t("form.submitUpdate")
                    : t("form.submitCreate")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
