"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./cn";
import { collapseAll, expandAll, initialExpand, reconcileExpand, toggleExpand, type ExpandState } from "@/lib/shared/expand-state";

export interface ExpandableItem {
  id: string;
  /** The one line shown when closed: what the row is. */
  summary: ReactNode;
  /** Short words for what the row still needs; shown beside the summary and used to open the first incomplete row. */
  needs: readonly string[];
  /** Buttons that stay visible when the row is closed (Accept, Remove). */
  actions?: ReactNode;
  /** The row's options, drawn only while it is open. */
  body: ReactNode;
}

export interface ExpandableLabels { expandAll: string; collapseAll: string; needs: (list: string) => string; open: string; close: string }

/**
 * A list of rows that open and close (Phase 59). It knows nothing about what a row is: both wizard slides pass the same item shape.
 * Closed rows keep the page short; an incomplete row says what it needs without being opened.
 */
export function ExpandableList({ items, labels, testId }: { items: readonly ExpandableItem[]; labels: ExpandableLabels; testId?: string }) {
  const base = useId();
  const inputs = items.map((i) => ({ id: i.id, attention: i.needs.length > 0 }));
  const [state, setState] = useState<ExpandState>(() => initialExpand(inputs));
  const key = inputs.map((i) => i.id).join("|");
  // The items can change under the list (a row added, one removed); reconcile returns the same state when nothing changed.
  useEffect(() => { setState((s) => reconcileExpand(s, inputs)); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3" data-testid={testId}>
      {items.length > 1 ? (
        <div className="flex flex-wrap gap-2 text-xs">
          <button type="button" className="btn-ghost btn-sm" onClick={() => setState((s) => expandAll(s, inputs))}>{labels.expandAll}</button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setState(collapseAll)}>{labels.collapseAll}</button>
        </div>
      ) : null}
      {items.map((item) => {
        const open = state.open.has(item.id);
        const panel = `${base}-${item.id}`;
        return (
          <article key={item.id} className="rounded-xl border border-slate-200 dark:border-white/10" data-open={open}>
            <header className="flex flex-wrap items-center gap-2 p-3">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panel}
                title={open ? labels.close : labels.open}
                onClick={() => setState((s) => toggleExpand(s, item.id))}
                className="flex min-h-9 min-w-0 flex-1 items-center gap-2 text-start"
              >
                <ChevronDown aria-hidden className={cn("h-4 w-4 shrink-0 transition-transform rtl:-scale-x-100", open ? "" : "-rotate-90")} />
                <span className="min-w-0 flex-1">{item.summary}</span>
                {item.needs.length > 0 ? <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-950" data-testid="needs-chip">{labels.needs(item.needs.join(", "))}</span> : null}
              </button>
              {item.actions}
            </header>
            {open ? <div id={panel} className="space-y-3 border-t border-slate-200 p-3 dark:border-white/10">{item.body}</div> : null}
          </article>
        );
      })}
    </div>
  );
}
