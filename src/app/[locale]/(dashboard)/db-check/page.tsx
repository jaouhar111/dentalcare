import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function checkDb() {
  try {
    const row = await db.meta.upsert({
      where: { key: "db_check" },
      create: { key: "db_check", value: "✓ Prisma + Neon adapter wired" },
      update: { value: "✓ Prisma + Neon adapter wired" },
    });
    return { ok: true as const, row };
  } catch (err) {
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export default async function DbCheckPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("DbCheck");
  const result = await checkDb();

  return (
    <main className="grid flex-1 place-items-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">{result.ok ? t("ok") : t("ko")}</CardTitle>
          <CardDescription>{t("description", { table: "meta" })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.ok ? (
            <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("key")}</dt>
              <dd className="font-mono">{result.row.key}</dd>
              <dt className="text-muted-foreground">{t("value")}</dt>
              <dd>{result.row.value}</dd>
              <dt className="text-muted-foreground">{t("updatedAt")}</dt>
              <dd className="num">{result.row.updatedAt.toISOString()}</dd>
            </dl>
          ) : (
            <pre className="bg-destructive/10 text-destructive rounded-md p-3 text-xs whitespace-pre-wrap">
              {result.message}
            </pre>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
