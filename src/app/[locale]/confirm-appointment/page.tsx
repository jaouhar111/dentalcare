import { getTranslations, setRequestLocale } from "next-intl/server";
import { confirmByToken } from "@/server/actions/appointments";

export const dynamic = "force-dynamic";

export default async function ConfirmAppointmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations("Appointments");

  if (!token) {
    return (
      <Center>
        <Card error title={t("status.CANCELLED")}>
          Missing token.
        </Card>
      </Center>
    );
  }

  const res = await confirmByToken(token);

  if (!res.ok) {
    return (
      <Center>
        <Card error title="🔴">
          {res.error.message}
        </Card>
      </Center>
    );
  }

  return (
    <Center>
      <Card title="🟢">{t("status.CONFIRMED")}</Card>
    </Center>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="bg-background grid min-h-screen place-items-center p-6">{children}</main>;
}

function Card({
  title,
  error,
  children,
}: {
  title: string;
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`w-full max-w-sm rounded-xl border p-8 text-center shadow-sm ${
        error
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
      }`}
    >
      <div className="text-4xl">{title}</div>
      <p className="mt-4 text-sm">{children}</p>
    </div>
  );
}
