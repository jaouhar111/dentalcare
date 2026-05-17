"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DentalCondition, ToothSurface } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/confirm-dialog";
import {
  commitPlanProposal,
  generatePlanFromChart,
  getToothHistory,
  recordEntry,
  removeEntry,
} from "@/server/actions/odontogram";
import type {
  ChartHistoryEntry,
  PlanProposalItem,
  ToothState,
} from "@/server/actions/odontogram-types";
import type { CatalogItemListItem } from "@/server/actions/treatments-types";
import { formatCurrency } from "@/lib/utils/format";
import type { Locale } from "@/i18n/routing";
import { ChartSVG } from "./chart-svg";
import { CONDITION_STYLE, CONDITIONS, WHOLE_TOOTH_CONDITIONS, zoneSurfaces } from "./constants";

const SURFACES: ToothSurface[] = [
  "OCCLUSAL",
  "MESIAL",
  "DISTAL",
  "VESTIBULAR",
  "LINGUAL",
  "INCISAL",
];

/// Reused for the SVG draftSurfaces prop when nothing is being edited — keeps
/// React from re-rendering the chart on every parent re-render.
const EMPTY_SURFACE_SET: ReadonlySet<ToothSurface> = new Set();

type Mode = "read" | "edit";

interface Props {
  patientId: string;
  /// Serialized chart map keyed by tooth number; the client rebuilds the Map.
  initialChart: Array<[number, ToothState]>;
  catalog: CatalogItemListItem[];
  canEdit: boolean;
  locale: Locale;
}

export function OdontogramClient({
  patientId,
  initialChart,
  catalog,
  canEdit,
  locale,
}: Props) {
  const t = useTranslations("Odontogram");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const confirm = useConfirm();

  const [chart, setChart] = useState<Map<number, ToothState>>(
    () => new Map(initialChart),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [multi, setMulti] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<Mode>(canEdit ? "edit" : "read");
  const [history, setHistory] = useState<ChartHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [proposal, setProposal] = useState<PlanProposalItem[] | null>(null);

  // ─── Form state (lifted from RecordForm so SVG surface clicks can update it) ───
  const [draftCondition, setDraftCondition] = useState<DentalCondition>("CARIES");
  const [draftSurfaces, setDraftSurfaces] = useState<Set<ToothSurface>>(new Set());
  const [draftNote, setDraftNote] = useState("");
  // Tracks which tooth's saved state the form last initialised from — lets us
  // reset only when the tooth changes (not on every chart mutation).
  const lastInitFor = useRef<number | null>(null);

  // Reset form values when switching to a new tooth, pre-filling with that
  // tooth's last-saved state so editing feels like "continue from here".
  useEffect(() => {
    if (selected === null || lastInitFor.current === selected) return;
    const saved = chart.get(selected);
    setDraftCondition(saved?.condition ?? "CARIES");
    setDraftSurfaces(new Set(saved?.surfaces ?? []));
    setDraftNote(saved?.note ?? "");
    lastInitFor.current = selected;
  }, [selected, chart]);

  // Drop surfaces when switching to a whole-tooth condition (schema requires
  // empty surfaces for HEALTHY; for the others it's just visual hygiene).
  useEffect(() => {
    if (WHOLE_TOOTH_CONDITIONS.has(draftCondition) && draftSurfaces.size > 0) {
      setDraftSurfaces(new Set());
    }
  }, [draftCondition, draftSurfaces.size]);

  // ─── selection ───
  function selectTooth(n: number) {
    if (selected === n) {
      // Click same tooth → toggle into multi-select (for planning).
      const next = new Set(multi);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      setMulti(next);
      return;
    }
    setSelected(n);
    void loadHistory(n);
  }

  /**
   * Clicking an SVG zone: select the tooth (if different) and toggle the
   * corresponding surface in the draft. When the tooth was unselected, the
   * useEffect above runs first and seeds the form with the saved state; we
   * then add the clicked surface on top so the dentist gets visual feedback.
   */
  function onSelectSurface(n: number, surface: ToothSurface) {
    // For the centre zone, the schema offers both OCCLUSAL and INCISAL — we
    // store whichever is anatomically right for this tooth.
    const zones = zoneSurfaces(n);
    const surfaceToToggle = surface === "OCCLUSAL" || surface === "INCISAL"
      ? zones.center
      : surface;

    if (selected !== n) {
      setSelected(n);
      void loadHistory(n);
      // Seed surface from the saved state, then add the clicked surface.
      const saved = chart.get(n);
      const next = new Set<ToothSurface>(saved?.surfaces ?? []);
      next.add(surfaceToToggle);
      setDraftCondition(saved?.condition ?? "CARIES");
      setDraftSurfaces(next);
      setDraftNote(saved?.note ?? "");
      lastInitFor.current = n;
      return;
    }

    // Same tooth → toggle the clicked surface.
    setDraftSurfaces((prev) => {
      const next = new Set(prev);
      if (next.has(surfaceToToggle)) next.delete(surfaceToToggle);
      else next.add(surfaceToToggle);
      return next;
    });
  }

  async function loadHistory(toothNumber: number) {
    setHistoryLoading(true);
    try {
      const res = await getToothHistory(patientId, toothNumber);
      if (!res.ok) {
        setHistory([]);
        return;
      }
      setHistory(res.data);
    } finally {
      setHistoryLoading(false);
    }
  }

  const lastUpdate = useMemo(() => {
    let latest: ToothState | null = null;
    for (const s of chart.values()) {
      if (!latest || s.recordedAt > latest.recordedAt) latest = s;
    }
    return latest;
  }, [chart]);

  return (
    <div className="space-y-4">
      {/* ─── Header ─── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-foreground text-lg font-semibold">{t("title")}</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {lastUpdate
              ? t("lastUpdate", {
                  date: new Intl.DateTimeFormat(locale, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }).format(lastUpdate.recordedAt),
                  name: lastUpdate.recordedByName,
                })
              : t("noEntries")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <div className="bg-muted inline-flex items-center rounded-lg p-0.5">
              {(["read", "edit"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded px-3 py-1 text-xs font-medium transition ${
                    mode === m
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(`modes.${m}`)}
                </button>
              ))}
            </div>
          )}
          {multi.size > 0 && (
            <Button
              type="button"
              onClick={async () => {
                const res = await generatePlanFromChart({
                  patientId,
                  toothNumbers: Array.from(multi),
                });
                if (!res.ok) {
                  toast.error(tToast("error"), { description: res.error.message });
                  return;
                }
                setProposal(res.data);
              }}
            >
              {t("actions.planSelected", { count: multi.size })}
            </Button>
          )}
        </div>
      </div>

      {/* ─── Two-column layout ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="bg-card border-border/60 rounded-xl border p-4 lg:col-span-2">
          <ChartSVG
            state={chart}
            selected={selected}
            multiSelected={multi}
            draftCondition={selected !== null && mode === "edit" && canEdit ? draftCondition : null}
            draftSurfaces={selected !== null && mode === "edit" && canEdit ? draftSurfaces : EMPTY_SURFACE_SET}
            onSelect={selectTooth}
            onSelectSurface={onSelectSurface}
          />
          <Legend />
        </div>

        <div className="space-y-4">
          {selected === null ? (
            <div className="bg-muted/30 border-border/60 rounded-xl border border-dashed p-6 text-center">
              <div className="text-foreground text-sm font-medium">{t("panel.selectTooth")}</div>
              <p className="text-muted-foreground mt-1 text-xs">{t("panel.selectToothDesc")}</p>
            </div>
          ) : (
            <ToothPanel
              toothNumber={selected}
              state={chart.get(selected) ?? null}
              history={history}
              historyLoading={historyLoading}
              mode={mode}
              canEdit={canEdit}
              draftCondition={draftCondition}
              draftSurfaces={draftSurfaces}
              draftNote={draftNote}
              onDraftConditionChange={setDraftCondition}
              onDraftSurfaceToggle={(s) =>
                setDraftSurfaces((prev) => {
                  const next = new Set(prev);
                  if (next.has(s)) next.delete(s);
                  else next.add(s);
                  return next;
                })
              }
              onDraftNoteChange={setDraftNote}
              onRecord={async () => {
                const res = await recordEntry({
                  patientId,
                  toothNumber: selected,
                  condition: draftCondition,
                  surfaces: WHOLE_TOOTH_CONDITIONS.has(draftCondition)
                    ? []
                    : Array.from(draftSurfaces),
                  note: draftNote || undefined,
                });
                if (!res.ok) {
                  toast.error(tToast("error"), {
                    description: t(`errors.${(res.error.code as "INVALID_TOOTH") ?? "INVALID_TOOTH"}`),
                  });
                  return false;
                }
                toast.success(t("toast.saved"));
                router.refresh();
                await loadHistory(selected);
                const savedSurfaces = WHOLE_TOOTH_CONDITIONS.has(draftCondition)
                  ? []
                  : Array.from(draftSurfaces);
                setChart((prev) => {
                  const next = new Map(prev);
                  next.set(selected, {
                    toothNumber: selected,
                    condition: draftCondition,
                    surfaces: savedSurfaces,
                    note: draftNote || null,
                    recordedAt: new Date(),
                    recordedByName: "—",
                    entryId: res.data.id,
                  });
                  return next;
                });
                // Clear the note for the next entry; keep condition+surfaces so
                // the dentist can immediately repeat on a neighbouring tooth.
                setDraftNote("");
                return true;
              }}
              onRemoveEntry={async (entryId) => {
                const ok = await confirm({
                  title: t("actions.delete"),
                  description: t("actions.deleteConfirm"),
                  confirmLabel: t("actions.delete"),
                  variant: "destructive",
                });
                if (!ok) return;
                const res = await removeEntry({ id: entryId, patientId });
                if (!res.ok) {
                  toast.error(tToast("error"), { description: tToast("errorDesc") });
                  return;
                }
                toast.success(t("toast.deleted"));
                router.refresh();
                await loadHistory(selected);
              }}
              locale={locale}
            />
          )}
        </div>
      </div>

      {proposal && (
        <PlanDialog
          proposal={proposal}
          catalog={catalog}
          patientId={patientId}
          onClose={() => setProposal(null)}
          onCommitted={() => {
            setProposal(null);
            setMulti(new Set());
            router.refresh();
          }}
          locale={locale}
        />
      )}
    </div>
  );
}

// ─── Tooth side panel ───────────────────────────────────────────────────────

function ToothPanel({
  toothNumber,
  state,
  history,
  historyLoading,
  mode,
  canEdit,
  draftCondition,
  draftSurfaces,
  draftNote,
  onDraftConditionChange,
  onDraftSurfaceToggle,
  onDraftNoteChange,
  onRecord,
  onRemoveEntry,
  locale,
}: {
  toothNumber: number;
  state: ToothState | null;
  history: ChartHistoryEntry[];
  historyLoading: boolean;
  mode: Mode;
  canEdit: boolean;
  draftCondition: DentalCondition;
  draftSurfaces: ReadonlySet<ToothSurface>;
  draftNote: string;
  onDraftConditionChange: (c: DentalCondition) => void;
  onDraftSurfaceToggle: (s: ToothSurface) => void;
  onDraftNoteChange: (n: string) => void;
  onRecord: () => Promise<boolean>;
  onRemoveEntry: (entryId: string) => Promise<void>;
  locale: Locale;
}) {
  const t = useTranslations("Odontogram");
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <>
      {/* Selected tooth header */}
      <div className="bg-card border-border/60 rounded-xl border p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-muted-foreground text-xs tracking-wider uppercase">
              {t("panel.selected")}
            </div>
            <div className="num mt-0.5 flex items-baseline gap-2">
              <span className="text-foreground text-2xl font-bold tracking-tight">{toothNumber}</span>
              <span className="text-muted-foreground text-sm">
                {t(`toothName.${toothNumber as 11}`)}
              </span>
            </div>
          </div>
          {state && (
            <div
              className="grid size-12 place-items-center rounded-lg text-2xl font-bold text-white shadow-sm"
              style={{ backgroundColor: CONDITION_STYLE[state.condition].bg }}
              aria-hidden
            >
              {CONDITION_STYLE[state.condition].glyph}
            </div>
          )}
        </div>

        {state ? (
          <>
            <div className="mt-4">
              <div className="text-muted-foreground mb-2 text-xs tracking-wider uppercase">
                {t("panel.currentCondition")}
              </div>
              <div
                className="rounded-lg border px-3 py-2 text-sm font-medium"
                style={{
                  borderColor: `${CONDITION_STYLE[state.condition].bg}55`,
                  backgroundColor: `${CONDITION_STYLE[state.condition].bg}11`,
                  color: CONDITION_STYLE[state.condition].text,
                }}
              >
                {CONDITION_STYLE[state.condition].glyph} {t(`condition.${state.condition}`)}
                {" · "}
                <span className="num font-normal">
                  {t("panel.since", { date: dateFmt.format(state.recordedAt) })}
                </span>
              </div>
            </div>
            {state.surfaces.length > 0 && (
              <div className="mt-3">
                <div className="text-muted-foreground mb-2 text-xs tracking-wider uppercase">
                  {t("panel.surfaces")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {state.surfaces.map((s) => (
                    <span
                      key={s}
                      className="border-input text-foreground bg-muted rounded-md border px-2 py-1 text-xs"
                    >
                      {t(`surface.${s}`)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {state.note && (
              <p className="text-muted-foreground mt-3 text-xs italic">{state.note}</p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground mt-4 text-sm italic">{t("panel.noEntry")}</p>
        )}
      </div>

      {/* Edit form */}
      {canEdit && mode === "edit" && (
        <RecordForm
          condition={draftCondition}
          surfaces={draftSurfaces}
          note={draftNote}
          onConditionChange={onDraftConditionChange}
          onSurfaceToggle={onDraftSurfaceToggle}
          onNoteChange={onDraftNoteChange}
          onSubmit={onRecord}
        />
      )}

      {/* History */}
      <div className="bg-card border-border/60 rounded-xl border p-5">
        <div className="text-muted-foreground mb-3 text-xs tracking-wider uppercase">
          {t("panel.history", { tooth: toothNumber })}
        </div>
        {historyLoading ? (
          <div className="text-muted-foreground text-sm">…</div>
        ) : history.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">{t("panel.noHistory")}</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {history.map((h) => {
              const style = CONDITION_STYLE[h.condition];
              return (
                <li key={h.id} className="flex gap-3">
                  <div
                    className="w-1 shrink-0 rounded"
                    style={{ backgroundColor: style.bg }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground font-medium">
                      {style.glyph} {t(`condition.${h.condition}`)}
                      {h.surfaces.length > 0 && (
                        <span className="text-muted-foreground font-normal">
                          {" · "}
                          {h.surfaces.map((s) => t(`surface.${s}`)).join(", ")}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground num text-xs">
                      {dateFmt.format(h.recordedAt)} · {h.recordedByName}
                    </div>
                    {h.note && (
                      <p className="text-foreground/70 mt-0.5 text-xs italic">{h.note}</p>
                    )}
                  </div>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onRemoveEntry(h.id)}
                      className="text-muted-foreground hover:text-destructive h-6 px-2 text-xs"
                    >
                      ×
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

/**
 * Controlled edit form. All state lives in OdontogramClient so the SVG can
 * read it (to draw the dashed "draft" outlines) and update it (clicks on
 * SVG zones toggle surfaces in here).
 */
function RecordForm({
  condition,
  surfaces,
  note,
  onConditionChange,
  onSurfaceToggle,
  onNoteChange,
  onSubmit,
}: {
  condition: DentalCondition;
  surfaces: ReadonlySet<ToothSurface>;
  note: string;
  onConditionChange: (c: DentalCondition) => void;
  onSurfaceToggle: (s: ToothSurface) => void;
  onNoteChange: (n: string) => void;
  onSubmit: () => Promise<boolean>;
}) {
  const t = useTranslations("Odontogram");
  const [isPending, startTransition] = useTransition();

  const surfacesDisabled = WHOLE_TOOTH_CONDITIONS.has(condition);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await onSubmit();
        });
      }}
      className="bg-card border-border/60 rounded-xl border p-5"
    >
      <div>
        <label className="text-muted-foreground mb-2 block text-xs tracking-wider uppercase">
          {t("form.condition")}
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {CONDITIONS.map((c) => {
            const active = c === condition;
            const style = CONDITION_STYLE[c];
            return (
              <button
                key={c}
                type="button"
                onClick={() => onConditionChange(c)}
                disabled={isPending}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-start text-xs transition ${
                  active
                    ? "border-primary bg-primary/5"
                    : "border-input hover:bg-muted/60"
                }`}
              >
                <span
                  className="grid size-4 shrink-0 place-items-center rounded text-[10px] font-bold text-white"
                  style={{ backgroundColor: style.bg }}
                  aria-hidden
                >
                  {style.glyph}
                </span>
                <span className="truncate">{t(`condition.${c}`)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!surfacesDisabled && (
        <div className="mt-4">
          <label className="text-muted-foreground mb-2 block text-xs tracking-wider uppercase">
            {t("form.surfaces")}
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {SURFACES.map((s) => {
              const active = surfaces.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSurfaceToggle(s)}
                  disabled={isPending}
                  className={`rounded-md border px-2 py-1.5 text-xs transition ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  {t(`surface.${s}`)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4">
        <label className="text-muted-foreground mb-2 block text-xs tracking-wider uppercase">
          {t("form.note")}
        </label>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder={t("form.notePlaceholder")}
          disabled={isPending}
          className="border-input bg-background w-full resize-y rounded-lg border px-3 py-2 text-sm shadow-xs disabled:opacity-50"
        />
      </div>

      <div className="mt-4">
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? t("form.submitting") : t("form.submit")}
        </Button>
      </div>
    </form>
  );
}

// ─── Legend ─────────────────────────────────────────────────────────────────

function Legend() {
  const t = useTranslations("Odontogram.condition");
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
      {CONDITIONS.map((c) => {
        const style = CONDITION_STYLE[c];
        return (
          <div key={c} className="flex items-center gap-1.5">
            <span
              className="grid size-4 place-items-center rounded text-[10px] font-bold text-white"
              style={{ backgroundColor: style.bg }}
              aria-hidden
            >
              {style.glyph}
            </span>
            <span className="text-foreground/80">{t(c)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Plan dialog ────────────────────────────────────────────────────────────

function PlanDialog({
  proposal,
  catalog,
  patientId,
  onClose,
  onCommitted,
  locale,
}: {
  proposal: PlanProposalItem[];
  catalog: CatalogItemListItem[];
  patientId: string;
  onClose: () => void;
  onCommitted: () => void;
  locale: Locale;
}) {
  const t = useTranslations("Odontogram");
  const tToast = useTranslations("Toast");
  const [items, setItems] = useState(() =>
    proposal.map((p) => ({
      toothNumber: p.toothNumber,
      condition: p.condition,
      surfaces: p.surfaces,
      catalogItemId: p.catalogItemId,
      catalogName: p.catalogName,
      defaultPrice: p.defaultPrice,
      rationale: p.rationale,
      unitPrice: p.defaultPrice ?? 0,
    })),
  );
  const [isPending, startTransition] = useTransition();

  const eligible = items.filter((i) => i.catalogItemId !== null);
  const total = eligible.reduce((s, i) => s + (i.unitPrice ?? 0), 0);

  function onCommit() {
    startTransition(async () => {
      const res = await commitPlanProposal({
        patientId,
        items: eligible.map((i) => ({
          catalogItemId: i.catalogItemId!,
          toothNumber: i.toothNumber,
          surfaces: i.surfaces,
          unitPrice: i.unitPrice,
        })),
      });
      if (!res.ok) {
        toast.error(tToast("error"), {
          description: t(
            `errors.${(res.error.code as "NO_VALID_ITEMS") ?? "NO_VALID_ITEMS"}`,
          ),
        });
        return;
      }
      toast.success(t("toast.planned", { count: res.data.created }));
      onCommitted();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("plan.title")}</DialogTitle>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {t("plan.subtitle", { count: items.length })}
          </p>
        </DialogHeader>

        {items.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm italic">
            {t("plan.noProposal")}
          </p>
        ) : (
          <>
            <ul className="divide-border/60 max-h-[50vh] divide-y overflow-y-auto">
              {items.map((it, idx) => (
                <li key={`${it.toothNumber}-${idx}`} className="flex items-center gap-3 py-3 text-sm">
                  <div className="num text-foreground w-10 shrink-0 font-mono font-semibold">
                    {it.toothNumber}
                  </div>
                  <div className="min-w-0 flex-1">
                    <select
                      value={it.catalogItemId ?? ""}
                      onChange={(e) => {
                        const next = [...items];
                        const id = e.target.value || null;
                        const cat = id ? catalog.find((c) => c.id === id) : null;
                        next[idx] = {
                          ...next[idx]!,
                          catalogItemId: id,
                          catalogName: cat?.name ?? null,
                          defaultPrice: cat?.defaultPrice ?? null,
                          unitPrice: cat?.defaultPrice ?? next[idx]!.unitPrice,
                        };
                        setItems(next);
                      }}
                      className="border-input bg-background w-full rounded-md border px-2 py-1 text-sm"
                    >
                      <option value="">— {t("plan.manual")} —</option>
                      {catalog.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} · {c.name}
                        </option>
                      ))}
                    </select>
                    <div className="text-muted-foreground mt-0.5 text-xs">{it.rationale}</div>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={it.unitPrice}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...next[idx]!, unitPrice: Number(e.target.value) };
                      setItems(next);
                    }}
                    className="border-input bg-background num w-24 rounded-md border px-2 py-1 text-end text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    className="text-muted-foreground hover:text-destructive h-7 px-2 text-xs"
                  >
                    {t("plan.remove")}
                  </Button>
                </li>
              ))}
            </ul>

            <div className="bg-muted/30 border-border/60 mt-3 flex items-center justify-between rounded-lg border px-4 py-2 text-sm">
              <span className="text-muted-foreground font-medium">{t("plan.total")}</span>
              <span className="num text-foreground text-base font-bold">
                {formatCurrency(total, locale)}
              </span>
            </div>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            {t("plan.close")}
          </Button>
          <Button
            type="button"
            onClick={onCommit}
            disabled={isPending || eligible.length === 0}
          >
            {isPending
              ? t("form.submitting")
              : t("plan.commit", { count: eligible.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
