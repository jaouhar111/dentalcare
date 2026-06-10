"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import { stopImpersonation } from "@/server/actions/super-admin-impersonation";

/**
 * Sticky warning banner shown across the whole dashboard while a
 * SUPER_ADMIN is impersonating a cabinet user. "Revenir" stops the
 * impersonation and hard-navigates back to the super-admin area.
 */
export function ImpersonationBanner({
  userName,
  clinicName,
  impersonatorName,
}: {
  userName: string | null;
  clinicName: string | null;
  impersonatorName: string | null;
}) {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  function stop() {
    startTransition(async () => {
      const res = await stopImpersonation();
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      window.location.assign(`/${locale}/super-admin`);
    });
  }

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 bg-amber-500 px-4 py-2 text-center text-[13px] text-amber-950">
      <span>
        👁️ Vous agissez en tant que <strong>{userName ?? "—"}</strong>
        {clinicName ? <> · {clinicName}</> : null}
        <span className="opacity-70">
          {" "}
          (impersonation par {impersonatorName ?? "super-admin"})
        </span>
      </span>
      <button
        type="button"
        onClick={stop}
        disabled={isPending}
        className="rounded-full bg-amber-950/90 px-3 py-1 text-[12px] font-semibold text-amber-50 transition hover:bg-amber-950 disabled:opacity-50"
      >
        Revenir à mon compte
      </button>
    </div>
  );
}
