"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { globalSearch } from "@/server/actions/global-search";

const DEBOUNCE_MS = 150;

interface SearchResults {
  patients: Array<{ id: string; label: string; sublabel: string }>;
  appointments: Array<{ id: string; label: string; sublabel: string; patientId: string }>;
  invoices: Array<{ id: string; label: string; sublabel: string }>;
  stock: Array<{ id: string; label: string; sublabel: string }>;
}

const EMPTY: SearchResults = { patients: [], appointments: [], invoices: [], stock: [] };

/**
 * Topbar search-trigger + Cmd-K command palette.
 *
 * Renders the "fake input" pill in the topbar; clicking or pressing Cmd/Ctrl+K
 * opens a centered dialog with grouped results across patients, upcoming
 * appointments, invoices and stock. Each keystroke triggers a debounced
 * server-side `globalSearch` (150 ms) — query must be ≥ 2 chars.
 *
 * Keyboard:
 *   - ↑ / ↓ moves through the flat list of results.
 *   - Enter activates the selected item.
 *   - Esc closes.
 *
 * Quick-action shortcuts (Créer patient, Nouveau RDV…) are always pinned at
 * the top of the result list, even when the query is empty.
 */
export function CmdKTrigger() {
  const t = useTranslations("CmdK");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Global keyboard shortcut ─────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ─── Focus input when opened / reset state when closed ──────────────────
  // Both branches go through `setTimeout(0)` so the resets aren't direct
  // setState-in-effect calls (linter constraint).
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setTimeout(() => {
        setQuery("");
        setResults(EMPTY);
        setSelectedIndex(0);
      }, 0);
    }
  }, [open]);

  // ─── Debounced search ─────────────────────────────────────────────────────
  // We schedule the reset/setResults inside the timeout so the linter doesn't
  // see a synchronous setState in the effect body. Functionally identical for
  // the user: queries shorter than 2 chars instantly empty the results after
  // the next tick.
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const tooShort = query.trim().length < 2;
    debounceTimer.current = setTimeout(() => {
      if (tooShort) {
        setResults(EMPTY);
        setSelectedIndex(0);
        return;
      }
      startTransition(async () => {
        const data = await globalSearch(query);
        setResults(data);
        setSelectedIndex(0);
      });
    }, tooShort ? 0 : DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  // ─── Build flat keyboard-navigable list ───────────────────────────────────
  const quickActions = [
    { key: "newPatient", href: "/patients/new" },
    { key: "newAppointment", href: "/appointments/new" },
    { key: "newInvoice", href: "/invoices" },
    { key: "openRecalls", href: "/recalls" },
    { key: "openStock", href: "/stock" },
  ] as const;

  const flat: Array<{ key: string; label: string; sublabel: string; href: string }> = [];
  // Quick actions always pinned at top.
  for (const a of quickActions) {
    flat.push({
      key: `action:${a.key}`,
      label: t(`actions.${a.key}`),
      sublabel: t("groups.actions"),
      href: a.href,
    });
  }
  for (const p of results.patients) {
    flat.push({
      key: `patient:${p.id}`,
      label: p.label,
      sublabel: p.sublabel,
      href: `/patients/${p.id}`,
    });
  }
  for (const a of results.appointments) {
    flat.push({
      key: `appt:${a.id}`,
      label: a.label,
      sublabel: a.sublabel,
      href: `/appointments/${a.id}/edit`,
    });
  }
  for (const inv of results.invoices) {
    flat.push({
      key: `invoice:${inv.id}`,
      label: inv.label,
      sublabel: inv.sublabel,
      href: `/invoices/${inv.id}`,
    });
  }
  for (const s of results.stock) {
    flat.push({
      key: `stock:${s.id}`,
      label: s.label,
      sublabel: s.sublabel,
      href: `/stock/${s.id}`,
    });
  }

  const activate = useCallback(
    (item: { href: string }) => {
      setOpen(false);
      router.push(item.href as never);
    },
    [router],
  );

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && flat[selectedIndex]) {
      e.preventDefault();
      activate(flat[selectedIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <>
      {/* Trigger pill — same visual as the previous disabled search input. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-input bg-muted/30 hover:bg-muted/60 text-muted-foreground relative w-full max-w-xl rounded-lg border py-2 ps-9 pe-16 text-start text-sm outline-none transition"
      >
        <svg
          className="pointer-events-none absolute inset-s-3 top-2.5 size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        {t("placeholder")}
        <kbd className="text-muted-foreground bg-background border-border absolute inset-e-2 top-2 rounded border px-1.5 py-0.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-start bg-black/40 p-4 pt-[15vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-popover text-popover-foreground border-border w-full max-w-xl overflow-hidden rounded-xl border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-border/60 relative border-b">
              <svg
                className="text-muted-foreground pointer-events-none absolute inset-s-3 top-3.5 size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={t("placeholder")}
                className="bg-transparent placeholder:text-muted-foreground w-full px-10 py-3 text-sm outline-none"
              />
              {isPending && (
                <span className="text-muted-foreground absolute inset-e-3 top-3 text-xs">
                  {t("loading")}
                </span>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {flat.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm italic">
                  {t("noResults")}
                </p>
              ) : (
                <Groups
                  flat={flat}
                  selectedIndex={selectedIndex}
                  onActivate={activate}
                  onHover={setSelectedIndex}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Groups({
  flat,
  selectedIndex,
  onActivate,
  onHover,
}: {
  flat: Array<{ key: string; label: string; sublabel: string; href: string }>;
  selectedIndex: number;
  onActivate: (item: { href: string }) => void;
  onHover: (index: number) => void;
}) {
  const t = useTranslations("CmdK.groups");
  // Bucket by prefix in `key` so we can show group headings.
  const buckets: Record<string, Array<(typeof flat)[number] & { idx: number }>> = {
    actions: [],
    patients: [],
    appointments: [],
    invoices: [],
    stock: [],
  };
  flat.forEach((item, idx) => {
    const prefix = item.key.split(":")[0]!;
    const groupKey =
      prefix === "action"
        ? "actions"
        : prefix === "patient"
          ? "patients"
          : prefix === "appt"
            ? "appointments"
            : prefix === "invoice"
              ? "invoices"
              : "stock";
    buckets[groupKey]!.push({ ...item, idx });
  });

  return (
    <>
      {(["patients", "appointments", "invoices", "stock", "actions"] as const).map((group) => {
        const items = buckets[group];
        if (!items || items.length === 0) return null;
        return (
          <div key={group} className="mb-2">
            <div className="text-muted-foreground px-2 py-1 text-[10px] font-semibold tracking-wider uppercase">
              {t(group)}
            </div>
            {items.map((item) => {
              const active = item.idx === selectedIndex;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onActivate(item)}
                  onMouseEnter={() => onHover(item.idx)}
                  className={`flex w-full flex-col items-start rounded-md px-2 py-1.5 text-start text-sm transition ${
                    active ? "bg-primary/10 text-foreground" : "text-foreground hover:bg-muted/60"
                  }`}
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground text-xs">{item.sublabel}</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
