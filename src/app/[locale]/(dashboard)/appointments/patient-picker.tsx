"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { listPatients } from "@/server/actions/patients";
import { formatMoroccanPhoneShort } from "@/lib/utils/phone";

interface PatientHit {
  id: string;
  firstName: string;
  lastName: string;
  cin: string | null;
  phone: string;
}

export function PatientPicker({
  initialPatient,
  onSelect,
}: {
  initialPatient: { id: string; name: string } | null;
  onSelect: (patientId: string, name: string) => void;
}) {
  const t = useTranslations("AppointmentForm");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PatientHit[]>([]);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(initialPatient);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  function runSearch(q: string) {
    startTransition(async () => {
      const res = await listPatients({ query: q, page: 1, pageSize: 8 });
      if (res.ok) {
        setHits(
          res.data.items.map((p) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            cin: p.cin,
            phone: p.phone,
          })),
        );
      } else {
        setHits([]);
      }
      setHasFetchedOnce(true);
    });
  }

  function search(q: string) {
    setQuery(q);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => runSearch(q.trim()), 200);
  }

  function onFocus() {
    setOpen(true);
    // First focus on an empty input: prefetch the 8 most recent patients so
    // the dropdown shows something immediately, no typing required.
    if (!hasFetchedOnce && query.trim() === "") {
      runSearch("");
    }
  }

  if (selected) {
    return (
      <div className="border-input bg-muted/30 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
        <span className="font-medium">{selected.name}</span>
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            onSelect("", "");
            setQuery("");
            setHits([]);
            setHasFetchedOnce(false);
            // Defer the focus to next tick so the input has mounted.
            setTimeout(() => setOpen(true), 0);
          }}
          className="text-muted-foreground hover:text-foreground text-xs underline"
        >
          {t("cancel")}
        </button>
      </div>
    );
  }

  const showDropdown = open && (isPending || hits.length > 0 || hasFetchedOnce);

  return (
    <div className="relative">
      <Input
        type="search"
        value={query}
        onChange={(e) => search(e.target.value)}
        onFocus={onFocus}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t("fields.patientPlaceholder")}
        autoComplete="off"
      />
      {showDropdown && (
        <ul
          role="listbox"
          className="bg-popover border-border absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md border text-sm shadow-lg"
        >
          {isPending && hits.length === 0 ? (
            <li className="text-muted-foreground px-3 py-3 text-xs italic">…</li>
          ) : hits.length === 0 ? (
            <li className="text-muted-foreground px-3 py-3 text-xs italic">
              {query ? "—" : "…"}
            </li>
          ) : (
            hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const name = `${h.firstName} ${h.lastName}`;
                    setSelected({ id: h.id, name });
                    onSelect(h.id, name);
                    setOpen(false);
                  }}
                  className="hover:bg-muted w-full px-3 py-2 text-start"
                >
                  <div className="font-medium">
                    {h.firstName} {h.lastName}
                  </div>
                  <div className="text-muted-foreground num text-xs">
                    {h.cin ?? "—"} · {formatMoroccanPhoneShort(h.phone)}
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
