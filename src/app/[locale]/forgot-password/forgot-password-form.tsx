"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { requestPasswordResetAction } from "@/server/actions/password-reset";

export function ForgotPasswordForm() {
  const t = useTranslations("ForgotPassword");
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  function onSubmit(formData: FormData) {
    const email = String(formData.get("email") ?? "");
    startTransition(async () => {
      await requestPasswordResetAction({ email });
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
          {t("success")}
        </div>
        <Link href="/login" className="text-primary text-sm hover:underline">
          ← {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          {t("emailLabel")}
        </label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? t("submitLoading") : t("submit")}
      </Button>
      <Link href="/login" className="text-muted-foreground hover:text-foreground block text-sm">
        ← {t("backToLogin")}
      </Link>
    </form>
  );
}
