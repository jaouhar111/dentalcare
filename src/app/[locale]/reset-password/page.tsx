import { getTranslations, setRequestLocale } from "next-intl/server";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations("ResetPassword");

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </div>

        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
            {t("missingToken")}
          </div>
        )}
      </div>
    </main>
  );
}
