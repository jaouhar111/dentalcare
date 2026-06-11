"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createCoupon, setCouponActive } from "@/server/actions/super-admin-coupons";
import type { CouponRow } from "@/server/actions/super-admin-coupons-types";

type Ctype = "PERCENT" | "FIXED";

const inputCls =
  "bg-background focus-visible:ring-primary/40 w-full rounded-xl px-3 py-2 text-[13px] ring-1 ring-black/[0.06] transition-shadow focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50";

export function CouponsManager({
  coupons,
  locale,
}: {
  coupons: CouponRow[];
  locale: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [type, setType] = useState<Ctype>("PERCENT");
  const [value, setValue] = useState("");
  const [maxRedemptions, setMax] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isPending, startTransition] = useTransition();
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  function create() {
    startTransition(async () => {
      const res = await createCoupon({
        code,
        type,
        value: Number(value),
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
        expiresAt: expiresAt || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Coupon créé.");
      setCode("");
      setValue("");
      setMax("");
      setExpiresAt("");
      router.refresh();
    });
  }

  function toggle(id: string, active: boolean) {
    startTransition(async () => {
      const res = await setCouponActive({ id, active });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(active ? "Coupon activé." : "Coupon désactivé.");
      router.refresh();
    });
  }

  return (
    <>
      {/* Create */}
      <section className="apple-card">
        <div className="apple-kpi-label mb-4">Nouveau coupon</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="text-muted-foreground mb-1.5 block text-[11px] font-medium uppercase">
              Code
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="DEMO20"
              disabled={isPending}
              className={`${inputCls} font-mono uppercase`}
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1.5 block text-[11px] font-medium uppercase">
              Type
            </label>
            <div className="inline-flex w-full rounded-xl bg-black/[0.04] p-0.5 ring-1 ring-black/[0.04] dark:bg-white/[0.06]">
              {(["PERCENT", "FIXED"] as Ctype[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  disabled={isPending}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[12px] font-medium transition ${
                    type === t
                      ? "bg-background text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "PERCENT" ? "%" : "MAD"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-muted-foreground mb-1.5 block text-[11px] font-medium uppercase">
              Valeur
            </label>
            <input
              type="number"
              min="1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === "PERCENT" ? "20" : "200"}
              disabled={isPending}
              className={`${inputCls} num`}
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1.5 block text-[11px] font-medium uppercase">
              Max util. (option.)
            </label>
            <input
              type="number"
              min="1"
              value={maxRedemptions}
              onChange={(e) => setMax(e.target.value)}
              placeholder="∞"
              disabled={isPending}
              className={`${inputCls} num`}
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1.5 block text-[11px] font-medium uppercase">
              Expire le (option.)
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              disabled={isPending}
              className={`${inputCls} num`}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              onClick={create}
              disabled={isPending || !code.trim() || !value}
              className="w-full"
            >
              Créer le coupon
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground mt-3 text-[12px]">
          Les codes sont stockés et prêts à être appliqués dès que le paiement
          en ligne sera branché.
        </p>
      </section>

      {/* List */}
      <section className="apple-card">
        <div className="apple-kpi-label mb-3">Coupons ({coupons.length})</div>
        {coupons.length === 0 ? (
          <p className="text-muted-foreground text-[13px]">Aucun coupon.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-muted-foreground border-border/60 border-b text-[10px] font-bold tracking-wider uppercase">
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">Remise</th>
                  <th className="py-2 pr-3">Utilisations</th>
                  <th className="py-2 pr-3">Expire</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3 text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id} className="border-border/40 border-b last:border-0">
                    <td className="py-2 pr-3 font-mono font-medium">{c.code}</td>
                    <td className="num py-2 pr-3">
                      {c.type === "PERCENT" ? `${c.value} %` : `${c.value} MAD`}
                    </td>
                    <td className="num py-2 pr-3">
                      {c.redemptions}
                      {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}
                    </td>
                    <td className="num py-2 pr-3">
                      {c.expiresAt ? dateFmt.format(c.expiresAt) : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {c.active ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Actif
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-end">
                      <button
                        type="button"
                        onClick={() => toggle(c.id, !c.active)}
                        disabled={isPending}
                        className="text-muted-foreground hover:text-foreground rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-black/[0.08] transition disabled:opacity-50 dark:ring-white/[0.1]"
                      >
                        {c.active ? "Désactiver" : "Activer"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
