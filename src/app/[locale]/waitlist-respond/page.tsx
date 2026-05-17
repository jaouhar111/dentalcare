import { getTranslations, setRequestLocale } from "next-intl/server";
import { acceptWaitlistProposal, declineWaitlistProposal } from "@/server/actions/waitlist";

export const dynamic = "force-dynamic";

export default async function WaitlistRespondPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; action?: "accept" | "decline" }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token, action } = await searchParams;
  const t = await getTranslations("Appointments");

  if (!token || (action !== "accept" && action !== "decline")) {
    return (
      <Center>
        <Card error title="⚠">
          Missing token or invalid action.
        </Card>
      </Center>
    );
  }

  const res =
    action === "accept"
      ? await acceptWaitlistProposal(token)
      : await declineWaitlistProposal(token);

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
      <Card title={action === "accept" ? "🟢" : "👋"}>
        {action === "accept" ? t("status.CONFIRMED") : "Merci"}
      </Card>
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
