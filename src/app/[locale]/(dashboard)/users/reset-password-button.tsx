"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resetUserPassword } from "@/server/actions/users";

export function ResetPasswordButton({ id, email }: { id: string; email: string }) {
  const t = useTranslations("Users");
  const tToast = useTranslations("Toast");
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await resetUserPassword({ id, password });
      if (!res.ok) {
        const msg =
          res.error.code === "PASSWORD_TOO_SHORT"
            ? t("errors.PASSWORD_TOO_SHORT")
            : res.error.message;
        toast.error(tToast("error"), { description: msg });
        return;
      }
      toast.success(t("toast.passwordReset"));
      setPassword("");
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
      >
        {t("resetPassword")}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("form.titleResetPassword")}</DialogTitle>
            <p className="text-muted-foreground text-sm">{email}</p>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="text-foreground mb-1 block text-xs font-medium">
                {t("form.newPassword")} *
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                maxLength={128}
                disabled={isPending}
                autoFocus
                className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
              />
              <p className="text-muted-foreground mt-1 text-xs">{t("form.passwordHint")}</p>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                {t("form.cancel")}
              </Button>
              <Button type="submit" disabled={isPending || password.length < 8}>
                {isPending ? t("form.submitting") : t("form.submitReset")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
