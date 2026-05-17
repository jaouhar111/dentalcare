import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { LegalFooter } from "@/components/legal-footer";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { redirect: redirectParam } = await searchParams;

  const session = await auth();
  if (session?.user) {
    redirect(`/${locale}`);
  }

  const t = await getTranslations("Login");
  const redirectTo = redirectParam ?? `/${locale}`;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="from-primary to-primary/70 hidden flex-col justify-between bg-gradient-to-br p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 64 64" className="h-9 w-9" fill="white" aria-hidden>
            <path d="M32 5C22 5 14 10 12 21C10 32 13 42 17 51L19 56C20 58 23 58 24 56L26 49C27 46 29 44 32 44C35 44 37 46 38 49L40 56C41 58 44 58 45 56L47 51C51 42 54 32 52 21C50 10 42 5 32 5Z" />
          </svg>
          <span className="text-xl font-bold tracking-tight">
            Dental<span className="opacity-80">Care</span>
          </span>
        </div>
        <div>
          <h1 className="text-4xl leading-tight font-bold tracking-tight">{t("tagline")}</h1>
          <p className="mt-4 max-w-md text-lg leading-relaxed opacity-90">{t("taglineDesc")}</p>
        </div>
        <p className="text-sm opacity-80">{t("footer")}</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2">
              <svg
                viewBox="0 0 64 64"
                className="text-primary h-8 w-8"
                fill="currentColor"
                aria-hidden
              >
                <path d="M32 5C22 5 14 10 12 21C10 32 13 42 17 51L19 56C20 58 23 58 24 56L26 49C27 46 29 44 32 44C35 44 37 46 38 49L40 56C41 58 44 58 45 56L47 51C51 42 54 32 52 21C50 10 42 5 32 5Z" />
              </svg>
              <span className="text-xl font-bold tracking-tight">
                Dental<span className="text-primary">Care</span>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <LocaleSwitcher />
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
          </div>

          <LoginForm redirectTo={redirectTo} />
          <LegalFooter variant="centered" />
        </div>
      </div>
    </div>
  );
}
