"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Promise-based confirmation dialog — drop-in replacement for the native
 * `window.confirm()`. Provider lives in the dashboard layout, and any
 * Client Component can do:
 *
 *     const confirm = useConfirm();
 *     if (await confirm({ title: "Delete?", description: "…", variant: "destructive" })) {
 *       …
 *     }
 *
 * `await` resolves to `true` (user confirmed) or `false` (cancelled / closed).
 * The dialog returns focus to the trigger element automatically.
 */

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /// "destructive" styles the confirm button red — used for delete/cancel
  /// actions. "primary" (default) uses the brand color.
  variant?: "primary" | "destructive";
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext);
  if (!fn) {
    throw new Error("useConfirm must be used inside <ConfirmDialogProvider>");
  }
  return fn;
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({ title: "" });
  const resolveRef = useRef<(value: boolean) => void>(null);

  const confirm = useCallback<ConfirmFn>((nextOpts) => {
    setOpts(nextOpts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function respond(value: boolean) {
    setOpen(false);
    resolveRef.current?.(value);
    resolveRef.current = null;
  }

  const isDestructive = opts.variant === "destructive";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) respond(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isDestructive && (
                <span className="grid size-8 place-items-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                </span>
              )}
              {opts.title}
            </DialogTitle>
            {opts.description && (
              <DialogDescription className="pt-1">{opts.description}</DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => respond(false)}>
              {opts.cancelLabel ?? t("cancel")}
            </Button>
            <Button
              type="button"
              variant={isDestructive ? "destructive" : "default"}
              onClick={() => respond(true)}
              autoFocus
            >
              {opts.confirmLabel ?? t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
