"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/server/actions/auth";

type ErrorCode = "INVALID_INPUT" | "INVALID_CREDENTIALS" | "RATE_LIMITED" | "GENERIC";

export function LoginForm({
  redirectTo,
  defaultEmail,
}: {
  redirectTo: string;
  defaultEmail?: string | null;
}) {
  const t = useTranslations("Login");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);

  function onSubmit(formData: FormData) {
    setErrorCode(null);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    startTransition(async () => {
      try {
        const res = await loginAction({ email, password }, redirectTo);
        if (!res.ok) {
          setErrorCode(res.error.code as ErrorCode);
          return;
        }
        router.replace(redirectTo);
      } catch {
        setErrorCode("GENERIC");
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="text-foreground mb-1.5 block text-sm font-medium">
          {t("emailLabel")}
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={defaultEmail ?? undefined}
          placeholder={t("emailPlaceholder")}
        />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="password" className="text-foreground block text-sm font-medium">
            {t("passwordLabel")}
          </label>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {errorCode && (
        <div role="alert" className="bg-destructive/10 text-destructive rounded-md p-2 text-sm">
          {t(`errors.${errorCode}`)}
        </div>
      )}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? t("submitLoading") : t("submit")}
      </Button>
    </form>
  );
}
