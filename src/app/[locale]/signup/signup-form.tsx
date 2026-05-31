"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signupAction } from "@/server/actions/auth";

type ErrorCode =
  | "INVALID_INPUT"
  | "TOO_SHORT"
  | "TOO_LONG"
  | "INVALID_EMAIL"
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_TOO_LONG"
  | "EMAIL_TAKEN"
  | "RATE_LIMITED"
  | "UNEXPECTED";

export function SignupForm({ locale }: { locale: "fr" | "en" }) {
  const t = useTranslations("Signup");
  const [isPending, startTransition] = useTransition();
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);

  function onSubmit(formData: FormData) {
    setErrorCode(null);
    const input = {
      clinicName: String(formData.get("clinicName") ?? ""),
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      phone: String(formData.get("phone") ?? "") || undefined,
      locale,
    };
    startTransition(async () => {
      try {
        const res = await signupAction(input);
        if (!res.ok) {
          setErrorCode(res.error.code as ErrorCode);
          return;
        }
        // The action returns the URL we should land on (typically the
        // login page with the email pre-filled and a success banner).
        // We use window.location instead of next-intl's router because
        // the target URL already carries query params Next's typed
        // router refuses to type-check.
        window.location.href = res.data.redirectTo;
      } catch (e) {
        console.error("[signup] client error", e);
        setErrorCode("UNEXPECTED");
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="clinicName" className="text-foreground mb-1.5 block text-sm font-medium">
          {t("clinicNameLabel")}
        </label>
        <Input
          id="clinicName"
          name="clinicName"
          type="text"
          autoComplete="organization"
          required
          maxLength={80}
          placeholder={t("clinicNamePlaceholder")}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fullName" className="text-foreground mb-1.5 block text-sm font-medium">
            {t("fullNameLabel")}
          </label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            maxLength={80}
            placeholder={t("fullNamePlaceholder")}
          />
        </div>
        <div>
          <label htmlFor="phone" className="text-foreground mb-1.5 block text-sm font-medium">
            {t("phoneLabel")}{" "}
            <span className="text-muted-foreground text-xs">({t("optional")})</span>
          </label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+212 6 12 34 56 78"
          />
        </div>
      </div>
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
          placeholder="vous@cabinet.ma"
        />
      </div>
      <div>
        <label htmlFor="password" className="text-foreground mb-1.5 block text-sm font-medium">
          {t("passwordLabel")}{" "}
          <span className="text-muted-foreground text-xs">({t("passwordHint")})</span>
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
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
      <p className="text-muted-foreground text-center text-xs">
        {t("legalNotice")}
      </p>
    </form>
  );
}
