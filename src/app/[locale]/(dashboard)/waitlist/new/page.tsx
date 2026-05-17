import { getTranslations, setRequestLocale } from "next-intl/server";
import { WaitlistTimePreference } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { listDentists } from "@/server/actions/dentists";
import { WaitlistForm, type WaitlistFormValues } from "../waitlist-form";

export default async function NewWaitlistStandalone({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Waitlist.form");

  const dentistsResult = await listDentists();
  const dentists = dentistsResult.ok
    ? dentistsResult.data
        .filter((d) => d.isActive)
        .map((d) => ({ id: d.id, name: `${d.firstName} ${d.lastName}` }))
    : [];

  const initial: WaitlistFormValues = {
    patientId: "",
    patientName: "",
    dentistId: "",
    durationMin: 30,
    timePreference: WaitlistTimePreference.ANY,
    notBefore: "",
    notAfter: "",
    reason: "",
  };

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <div className="mb-6">
        <Link
          href={"/waitlist" as never}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          ← {t("cancel")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{t("title")}</h1>
      </div>
      <div className="bg-card border-border/60 rounded-xl border p-6 lg:p-8">
        <WaitlistForm initial={initial} dentists={dentists} />
      </div>
    </div>
  );
}
