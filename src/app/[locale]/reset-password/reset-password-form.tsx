"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { resetPasswordAction } from "@/server/actions/password-reset";

type ErrorCode =
  | "INVALID_INPUT"
  | "INVALID_TOKEN"
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_MISMATCH"
  | "GENERIC";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("ResetPassword");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);
  const [success, setSuccess] = useState(false);

  function onSubmit(formData: FormData) {
    setErrorCode(null);
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    if (password !== confirm) {
      setErrorCode("PASSWORD_MISMATCH");
      return;
    }
    startTransition(async () => {
      const res = await resetPasswordAction({ token, password });
      if (!res.ok) {
        setErrorCode(res.error.code as ErrorCode);
        return;
      }
      setSuccess(true);
      setTimeout(() => router.replace("/login"), 1500);
    });
  }

  if (success) {
    return (
      <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
        {t("success")}
      </div>
    );
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          {t("passwordLabel")}
        </label>
        <Input id="password" name="password" type="password" minLength={8} required />
      </div>
      <div>
        <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium">
          {t("confirmLabel")}
        </label>
        <Input id="confirm" name="confirm" type="password" minLength={8} required />
      </div>
      {errorCode && (
        <div role="alert" className="bg-destructive/10 text-destructive rounded-md p-2 text-sm">
          {t(`errors.${errorCode}`)}
        </div>
      )}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? t("submitLoading") : t("submit")}
      </Button>
      <Link href="/login" className="text-muted-foreground hover:text-foreground block text-sm">
        ← Login
      </Link>
    </form>
  );
}
