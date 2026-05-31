import { UserRole } from "@prisma/client";
import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/rbac";
import { listAuditLog, listAuditEntities } from "@/server/actions/audit-log";
import { AuditRow } from "./audit-row";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    entity?: string;
    action?: string;
    from?: string;
    to?: string;
    offset?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // SUPER_ADMIN only — clinic admins no longer see the platform audit log.
  await requireRole([UserRole.SUPER_ADMIN]);

  const sp = await searchParams;
  const offset = Math.max(Number(sp.offset ?? 0), 0);

  const [pageResult, entitiesResult] = await Promise.all([
    listAuditLog({
      entity: sp.entity || undefined,
      action: sp.action || undefined,
      from: sp.from || undefined,
      to: sp.to || undefined,
      offset,
      pageSize: PAGE_SIZE,
    }),
    listAuditEntities(),
  ]);

  if (!pageResult.ok) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {pageResult.error.message}
        </div>
      </div>
    );
  }

  const { items, total } = pageResult.data;
  const entities = entitiesResult.ok ? entitiesResult.data : [];

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + PAGE_SIZE, total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  function buildHref(nextOffset: number): string {
    const qs = new URLSearchParams();
    if (sp.entity) qs.set("entity", sp.entity);
    if (sp.action) qs.set("action", sp.action);
    if (sp.from) qs.set("from", sp.from);
    if (sp.to) qs.set("to", sp.to);
    if (nextOffset > 0) qs.set("offset", String(nextOffset));
    const s = qs.toString();
    return `/super-admin/audit${s ? `?${s}` : ""}`;
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-6">
        <h1 className="page-h1">Registre d'audit</h1>
        <p className="page-sub">
          Journal des opérations sensibles (loi 09-08). <span className="num">{total}</span>{" "}
          entrée{total > 1 ? "s" : ""}.
        </p>
      </header>

      {/* ─── Filters ──────────────────────────────────────────────────────── */}
      <form
        method="get"
        className="bg-card border-border/60 mb-4 rounded-xl border p-4"
        aria-label="Filtres d'audit"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium">
              Entité
            </label>
            <select
              name="entity"
              defaultValue={sp.entity ?? ""}
              className="border-input bg-background w-full rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">Toutes</option>
              {entities.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium">
              Action contient
            </label>
            <input
              type="text"
              name="action"
              defaultValue={sp.action ?? ""}
              placeholder="ex. erase, share, emit"
              className="border-input bg-background w-full rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium">
              Du
            </label>
            <input
              type="date"
              name="from"
              defaultValue={sp.from ?? ""}
              className="border-input bg-background w-full rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs font-medium">
              Au
            </label>
            <input
              type="date"
              name="to"
              defaultValue={sp.to ?? ""}
              className="border-input bg-background w-full rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex flex-1 items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium"
            >
              Filtrer
            </button>
            <Link
              href={"/super-admin/audit" as never}
              className="border-input hover:bg-muted bg-background inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm"
            >
              Reset
            </Link>
          </div>
        </div>
      </form>

      {/* ─── Table ────────────────────────────────────────────────────────── */}
      <div className="bg-card border-border/60 overflow-hidden rounded-xl border">
        {items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-foreground text-base font-medium">Aucune entrée</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Ajustez les filtres ou élargissez la plage de dates.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground border-border/60 border-b text-xs tracking-wider uppercase">
              <tr>
                <th className="w-44 px-4 py-3 text-start font-semibold">Date</th>
                <th className="w-48 px-4 py-3 text-start font-semibold">Utilisateur</th>
                <th className="w-32 px-4 py-3 text-start font-semibold">Entité</th>
                <th className="px-4 py-3 text-start font-semibold">Action</th>
                <th className="w-12 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {items.map((it) => (
                <AuditRow key={it.id} item={it} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── Pagination ──────────────────────────────────────────────────── */}
      {total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            <span className="num">{pageStart}</span>–<span className="num">{pageEnd}</span>{" "}
            sur <span className="num">{total}</span>
          </p>
          <div className="flex gap-2">
            <Link
              href={buildHref(Math.max(offset - PAGE_SIZE, 0)) as never}
              aria-disabled={!hasPrev}
              className={`border-input rounded-md border px-3 py-1.5 text-sm ${hasPrev ? "hover:bg-muted" : "pointer-events-none opacity-40"}`}
            >
              ← Précédent
            </Link>
            <Link
              href={buildHref(offset + PAGE_SIZE) as never}
              aria-disabled={!hasNext}
              className={`border-input rounded-md border px-3 py-1.5 text-sm ${hasNext ? "hover:bg-muted" : "pointer-events-none opacity-40"}`}
            >
              Suivant →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
