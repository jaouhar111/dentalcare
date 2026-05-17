import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { getDentist } from "@/server/actions/dentists";
import { formatMoroccanPhone } from "@/lib/utils/phone";
import { InfoTab } from "./info-tab";
import { ScheduleEditor } from "./schedule-editor";
import { AbsencesEditor } from "./absences-editor";

export const dynamic = "force-dynamic";

type Tab = "info" | "schedule" | "absences";
const TABS: Tab[] = ["info", "schedule", "absences"];

export default async function DentistDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ tab?: Tab }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    redirect(`/${locale}` as never);
  }

  const { tab = "info" } = await searchParams;
  const activeTab: Tab = TABS.includes(tab) ? tab : "info";

  const dentist = await getDentist(id);
  if (!dentist) notFound();

  const t = await getTranslations("Dentists");
  const dentistName = `${dentist.firstName} ${dentist.lastName}`;

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <Link
        href={"/dentists" as never}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        ← {t("title")}
      </Link>

      <header className="bg-card border-border/60 rounded-xl border p-6">
        <div className="flex items-start gap-5">
          <div
            className="grid size-16 place-items-center rounded-2xl text-xl font-bold text-white"
            style={{ backgroundColor: dentist.color }}
          >
            {(dentist.firstName[0] ?? "") + (dentist.lastName[0] ?? "")}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">
              Dr {dentist.firstName} {dentist.lastName}
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {dentist.specialty ?? "—"}
              {dentist.phone && (
                <>
                  {" · "}
                  <span className="num">{formatMoroccanPhone(dentist.phone)}</span>
                </>
              )}
              {dentist.email && <> · {dentist.email}</>}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {dentist.isActive ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                  ● {t("active")}
                </span>
              ) : (
                <span className="bg-muted text-muted-foreground border-border inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                  ○ {t("inactive")}
                </span>
              )}
              {dentist.user && (
                <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                  🔑 {dentist.user.email}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <nav className="border-border/60 mt-6 flex flex-wrap gap-1 border-b">
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <Link
              key={tab}
              href={`/dentists/${dentist.id}?tab=${tab}` as never}
              className={
                isActive
                  ? "text-primary border-primary -mb-px border-b-2 px-4 py-2 text-sm font-medium"
                  : "text-muted-foreground hover:text-foreground -mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium"
              }
            >
              {t(`tabs.${tab}`)}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6">
        {activeTab === "info" && (
          <InfoTab
            initial={{
              id: dentist.id,
              firstName: dentist.firstName,
              lastName: dentist.lastName,
              specialty: dentist.specialty ?? "",
              phone: dentist.phone ?? "",
              email: dentist.email ?? "",
              color: dentist.color,
            }}
          />
        )}
        {activeTab === "schedule" && (
          <ScheduleEditor
            dentistId={dentist.id}
            dentistName={dentistName}
            initial={dentist.schedules.map((s) => ({
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              endTime: s.endTime,
            }))}
          />
        )}
        {activeTab === "absences" && (
          <AbsencesEditor
            dentistId={dentist.id}
            initial={dentist.absences.map((a) => ({
              id: a.id,
              startAt: a.startAt,
              endAt: a.endAt,
              reason: a.reason,
            }))}
          />
        )}
      </div>
    </div>
  );
}
