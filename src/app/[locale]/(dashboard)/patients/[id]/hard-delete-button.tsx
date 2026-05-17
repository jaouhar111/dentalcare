"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { hardDeletePatient } from "@/server/actions/gdpr";

/**
 * Admin-only "Erase forever" button — implements Loi 09-08 art. 8 (right
 * to erasure). Two-step UI:
 *   1. Open the dialog → confirm the patient name + write a reason.
 *   2. Submit → server transactionally deletes everything.
 *
 * The reason is appended to the audit log so the tombstone shows
 * intent ("Patient request", "Duplicate record", "Data breach response"…).
 * Reason text is enforced server-side too (min 8 chars).
 */
export function HardDeletePatientButton({
  patientId,
  patientName,
}: {
  patientId: string;
  patientName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [isPending, startTransition] = useTransition();

  const canSubmit = reason.trim().length >= 8 && confirmName.trim() === patientName;

  function onConfirm() {
    startTransition(async () => {
      const res = await hardDeletePatient({ patientId, reason: reason.trim() });
      if (!res.ok) {
        toast.error("Suppression refusée", { description: res.error.message });
        return;
      }
      toast.success("Patient supprimé définitivement", {
        description: `Toutes les données de ${patientName} ont été effacées.`,
      });
      setOpen(false);
      router.replace("/patients" as never);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60"
        title="Supprimer définitivement toutes les données du patient (loi 09-08 art. 8)"
      >
        <svg
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        Effacer RGPD
      </button>

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-rose-700 dark:text-rose-300">
              Effacement définitif (loi 09-08 art. 8)
            </DialogTitle>
            <DialogDescription>
              Cette action <strong>supprime définitivement</strong> toutes les données de{" "}
              <strong>{patientName}</strong> : rendez-vous, soins, ordonnances, factures,
              radiographies, photos, paiements. <strong>Irréversible.</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Saisissez le nom du patient pour confirmer
              </label>
              <input
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={patientName}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                disabled={isPending}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Motif (sera consigné au registre)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex. Demande explicite du patient datée du 12 mai 2026, duplicate, etc."
                rows={3}
                minLength={8}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                disabled={isPending}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Minimum 8 caractères. Sera visible dans le registre d'audit.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={!canSubmit || isPending}
            >
              {isPending ? "Effacement…" : "Effacer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
