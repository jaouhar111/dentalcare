"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  disconnectOpenwaConnection,
  getOpenwaConnectionState,
  startOpenwaConnection,
} from "@/server/actions/openwa-session";
import type { OpenwaConnectionState } from "@/server/actions/openwa-session-types";

/**
 * QR-onboarding panel for the cabinet's WhatsApp connection.
 *
 * The three substantive states have distinct rendering:
 *   - not_connected → big "Connect WhatsApp" CTA + value-prop blurb
 *   - awaiting_scan → QR code, instructions to scan, polling 3s
 *   - ready         → phone + display name + disconnect button
 *
 * Polling cadence: 3s while the session is `connecting` or
 * `awaiting_scan` (the QR also auto-refreshes server-side as it expires).
 * Stops once we land on `ready` or `failed`, restarts on user action.
 */
export function WhatsAppConnectionPanel({
  initial,
  autoStart = false,
}: {
  initial: OpenwaConnectionState;
  /// When `true`, immediately trigger `startOpenwaConnection` on mount
  /// if the clinic isn't connected yet. Used by the onboarding wizard so
  /// the QR appears in a square the moment the user lands on step 1,
  /// skipping the "Connecter WhatsApp" CTA they would otherwise see.
  autoStart?: boolean;
}) {
  const [state, setState] = useState<OpenwaConnectionState>(initial);
  const [isPending, startTransition] = useTransition();
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAutoStartedRef = useRef(false);

  const refresh = useCallback(async () => {
    const res = await getOpenwaConnectionState();
    if (res.ok) setState(res.data);
  }, []);

  function onConnect() {
    startTransition(async () => {
      const res = await startOpenwaConnection();
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setState(res.data);
    });
  }

  // Auto-start on mount when the wizard asks for it. Guarded by a ref
  // so React 18 strict-mode double-mounts don't trigger two sessions.
  useEffect(() => {
    if (
      autoStart &&
      !hasAutoStartedRef.current &&
      state.state === "not_connected"
    ) {
      hasAutoStartedRef.current = true;
      onConnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, state.state]);

  // Auto-poll while the connection is in flux. We deliberately stop on
  // terminal states (ready / failed) so a healthy clinic doesn't burn
  // the gateway with permanent polling.
  //
  // Cadence is tighter while `connecting` (1.2s): the gateway's Chromium
  // cold-start takes ~45s to emit the first QR, and we want to surface it
  // the instant it lands rather than up to 3s later. Once the QR is shown
  // (`awaiting_scan`) there's no rush, so we relax back to 3s.
  useEffect(() => {
    const interval =
      state.state === "connecting"
        ? 1200
        : state.state === "awaiting_scan"
          ? 3000
          : null;
    if (interval === null) return;
    pollRef.current = setTimeout(refresh, interval);
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [state.state, refresh]);

  function onDisconnect() {
    startTransition(async () => {
      const res = await disconnectOpenwaConnection();
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("WhatsApp déconnecté.");
      setState({
        state: "not_connected",
        sessionId: null,
        qrCode: null,
        phone: null,
        pushName: null,
        error: null,
      });
    });
  }

  return (
    <section className="apple-card mb-6 p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-foreground text-[18px] font-semibold tracking-tight">
            WhatsApp du cabinet
          </h2>
          <p className="text-muted-foreground mt-1 text-[13px] leading-[1.5]">
            Liez votre numéro WhatsApp pour que la réceptionniste IA puisse
            répondre aux patients. Scannez le QR avec l&apos;app WhatsApp
            Business de votre téléphone — vous restez maître du numéro.
          </p>
        </div>
        <StatusPill state={state.state} />
      </div>

      {state.state === "ready" ? (
        <ReadyView state={state} onDisconnect={onDisconnect} isPending={isPending} />
      ) : state.state === "awaiting_scan" ? (
        <AwaitingScanView state={state} />
      ) : state.state === "connecting" ? (
        <ConnectingView />
      ) : state.state === "failed" ? (
        <FailedView state={state} onRetry={onConnect} isPending={isPending} />
      ) : (
        <NotConnectedView onConnect={onConnect} isPending={isPending} />
      )}
    </section>
  );
}

// ── States ──────────────────────────────────────────────────────────────

function NotConnectedView({
  onConnect,
  isPending,
}: {
  onConnect: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-black/[0.08] bg-black/[0.015] p-6 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <div>
        <p className="text-foreground text-[14px] font-medium">
          Pas encore connecté
        </p>
        <ul className="text-muted-foreground mt-2 list-inside list-disc text-[13px] leading-[1.6]">
          <li>Onboarding en 2 minutes — pas de validation Meta</li>
          <li>Votre dentiste continue à utiliser WhatsApp normalement</li>
          <li>Vous pouvez délier à tout moment</li>
        </ul>
      </div>
      <button
        type="button"
        onClick={onConnect}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-full bg-[#0071e3] px-4 py-2 text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition hover:brightness-110 disabled:opacity-60"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24z" />
        </svg>
        {isPending ? "Préparation…" : "Connecter WhatsApp"}
      </button>
    </div>
  );
}

function ConnectingView() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-black/[0.02] p-6 dark:bg-white/[0.02]">
      <div className="size-5 animate-spin rounded-full border-2 border-[#0071e3]/30 border-t-[#0071e3]" />
      <div>
        <p className="text-foreground text-[14px]">
          Préparation de la session WhatsApp Web…
        </p>
        <p className="text-muted-foreground mt-0.5 text-[12px]">
          La première connexion peut prendre jusqu&apos;à une minute. Préparez
          votre téléphone : WhatsApp Business → Appareils connectés.
        </p>
      </div>
    </div>
  );
}

function AwaitingScanView({ state }: { state: OpenwaConnectionState }) {
  // Countdown reset whenever the QR payload changes (server polled a
  // fresh one). The 30s baseline matches WhatsApp Web's refresh cadence;
  // when we hit 0 we show "Renouvellement…" until the next poll lands
  // a new QR.
  const QR_LIFETIME_SEC = 30;
  const [secondsLeft, setSecondsLeft] = useState(QR_LIFETIME_SEC);
  const previousQrRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.qrCode && state.qrCode !== previousQrRef.current) {
      previousQrRef.current = state.qrCode;
      setSecondsLeft(QR_LIFETIME_SEC);
    }
  }, [state.qrCode]);
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const ringPct = Math.max(0, secondsLeft / QR_LIFETIME_SEC) * 100;
  const expiring = secondsLeft <= 5;

  return (
    <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
      <div className="relative mx-auto sm:mx-0">
        <div className="relative bg-white p-2 rounded-xl ring-1 ring-black/[0.08]">
          {state.qrCode ? (
            <img
              src={state.qrCode}
              alt="WhatsApp QR code"
              className="size-56 sm:size-48"
            />
          ) : (
            <div className="grid size-56 sm:size-48 place-items-center text-muted-foreground text-[12px]">
              Génération du QR…
            </div>
          )}
        </div>
        {state.qrCode ? (
          <div
            className={`mt-2 flex items-center justify-center gap-2 text-[11px] font-medium ${
              expiring
                ? "text-amber-700 dark:text-amber-300"
                : "text-muted-foreground"
            }`}
          >
            <span
              className="size-1.5 rounded-full bg-current"
              style={{ opacity: 0.4 + (ringPct / 100) * 0.6 }}
            />
            {secondsLeft > 0
              ? `Expire dans ${secondsLeft}s`
              : "Renouvellement…"}
          </div>
        ) : null}
      </div>
      <div className="text-[13px] leading-[1.6]">
        <p className="text-foreground mb-2 text-[14px] font-medium">
          Scannez avec WhatsApp Business
        </p>
        <ol className="text-muted-foreground list-inside list-decimal space-y-1">
          <li>
            Ouvrez <strong>WhatsApp Business</strong> sur le téléphone du cabinet
          </li>
          <li>
            Menu (⋮) → <strong>Appareils connectés</strong>
          </li>
          <li>
            <strong>Lier un appareil</strong> → scanner ce QR
          </li>
        </ol>
        <p className="text-muted-foreground mt-3 text-[11px]">
          Le QR se renouvelle automatiquement. Statut mis à jour toutes les 3 sec.
        </p>
      </div>
    </div>
  );
}

function ReadyView({
  state,
  onDisconnect,
  isPending,
}: {
  state: OpenwaConnectionState;
  onDisconnect: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-emerald-500/10 p-5 ring-1 ring-emerald-500/20">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24z" />
          </svg>
        </span>
        <div>
          <div className="text-foreground text-[14px] font-semibold">
            {state.pushName ?? "Connecté"}
          </div>
          <div className="text-muted-foreground text-[12px]">
            {state.phone ? `+${state.phone}` : "Numéro inconnu"} ·{" "}
            session {state.sessionId?.slice(0, 8)}…
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onDisconnect}
        disabled={isPending}
        className="text-red-700 hover:bg-red-500/10 rounded-md border border-red-500/30 px-3 py-1.5 text-[12px] font-medium transition disabled:opacity-60 dark:text-red-300"
      >
        Déconnecter
      </button>
    </div>
  );
}

function FailedView({
  state,
  onRetry,
  isPending,
}: {
  state: OpenwaConnectionState;
  onRetry: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-red-500/10 p-5 ring-1 ring-red-500/20">
      <p className="text-red-800 dark:text-red-300 text-[14px] font-medium">
        Connexion impossible
      </p>
      {state.error ? (
        <p className="text-red-700/80 dark:text-red-300/80 text-[12px]">
          {state.error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onRetry}
        disabled={isPending}
        className="self-start rounded-md border border-red-500/30 px-3 py-1.5 text-[12px] font-medium text-red-700 dark:text-red-300"
      >
        Réessayer
      </button>
    </div>
  );
}

function StatusPill({ state }: { state: OpenwaConnectionState["state"] }) {
  const variants: Record<
    OpenwaConnectionState["state"],
    { label: string; cls: string }
  > = {
    not_connected: {
      label: "Non connecté",
      cls: "bg-black/[0.05] text-muted-foreground dark:bg-white/[0.06]",
    },
    connecting: {
      label: "Démarrage…",
      cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    },
    awaiting_scan: {
      label: "Scan en attente",
      cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    },
    ready: {
      label: "Connecté",
      cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    },
    failed: {
      label: "Erreur",
      cls: "bg-red-500/15 text-red-700 dark:text-red-300",
    },
    unknown: {
      label: "Inconnu",
      cls: "bg-black/[0.05] text-muted-foreground dark:bg-white/[0.06]",
    },
  };
  const v = variants[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] uppercase ${v.cls}`}
    >
      <span className="size-1 rounded-full bg-current" />
      {v.label}
    </span>
  );
}
