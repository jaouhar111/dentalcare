import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DentistForm, type DentistFormValues } from "../dentist-form";

export default async function NewDentistStandalone({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("DentistForm");

  const initial: DentistFormValues = {
    firstName: "",
    lastName: "",
    specialty: "",
    phone: "",
    email: "",
    color: "#0891B2",
  };

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <div className="mb-6">
        <Link
          href={"/dentists" as never}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          ← {t("cancel")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{t("titleCreate")}</h1>
      </div>
      <div className="bg-card border-border/60 rounded-xl border p-6 lg:p-8">
        <DentistForm initial={initial} />
      </div>
    </div>
  );
}
