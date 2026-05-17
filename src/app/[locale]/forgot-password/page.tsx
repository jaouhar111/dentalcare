import { getTranslations, setRequestLocale } from "next-intl/server";
import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ForgotPassword");

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </div>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
