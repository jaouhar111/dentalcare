"use client";

import { useState } from "react";
import type { AuditLogListItem } from "@/server/actions/audit-log-types";

/**
 * One row of the audit table. Clicking the chevron expands the payload as
 * pretty-printed JSON underneath the row. Stays a Client Component because
 * Server Components can't hold local UI state.
 */
export function AuditRow({ item }: { item: AuditLogListItem }) {
  const [open, setOpen] = useState(false);
  const hasPayload = item.payload !== null && item.payload !== undefined;
  const date = new Date(item.createdAt);
  const dateStr = date.toLocaleDateString("fr-FR");
  const timeStr = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;

  return (
    <>
      <tr className="hover:bg-muted/30">
        <td className="px-4 py-2.5">
          <div className="flex flex-col">
            <span className="num text-foreground text-sm">{dateStr}</span>
            <span className="num text-muted-foreground text-xs">{timeStr}</span>
          </div>
        </td>
        <td className="px-4 py-2.5">
          {item.userName ? (
            <div className="flex flex-col">
              <span className="text-foreground text-sm">{item.userName}</span>
              <span className="text-muted-foreground text-xs">{item.userEmail}</span>
            </div>
          ) : (
            <span className="text-muted-foreground text-xs italic">système</span>
          )}
        </td>
        <td className="px-4 py-2.5">
          <span className="bg-muted text-foreground inline-block rounded-md px-2 py-0.5 text-xs font-medium">
            {item.entity}
          </span>
          {item.entityId && (
            <span className="num text-muted-foreground ml-1 text-[10px]">
              #{item.entityId.slice(-6)}
            </span>
          )}
        </td>
        <td className="px-4 py-2.5">
          <code className="text-foreground text-[13px]">{item.action}</code>
        </td>
        <td className="px-2 py-2.5 text-center">
          {hasPayload ? (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="hover:bg-muted text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-md"
              title="Voir le payload"
            >
              <svg
                className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          ) : null}
        </td>
      </tr>
      {open && hasPayload && (
        <tr className="bg-muted/20">
          <td colSpan={5} className="px-4 py-3">
            <pre className="text-foreground/80 max-h-72 overflow-auto rounded-md bg-slate-950/5 p-3 text-[11px] dark:bg-white/5">
              {JSON.stringify(item.payload, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
