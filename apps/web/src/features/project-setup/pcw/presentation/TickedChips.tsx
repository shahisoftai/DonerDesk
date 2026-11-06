"use client";

import type { Selection } from "../domain/place-picker";
import type { PcwCopy } from "../copy";

const SHOWN = 30;

/** What is ticked, as removable chips with a count: the one place to see (and undo) the whole choice at a glance. */
export function TickedChips({ selection, copy, saving, onRemove, onClear }: {
  selection: Selection; copy: PcwCopy["places"]; saving: boolean; onRemove: (ref: string) => void; onClear: () => void;
}) {
  const entries = [...selection.values()].sort((a, b) => a.node.level - b.node.level || a.node.name.localeCompare(b.node.name));
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <strong>{entries.length === 0 ? copy.nothingTicked : copy.ticked(entries.length)}</strong>
        {entries.length > 0 ? <button type="button" className="text-slate-600 underline dark:text-slate-300" onClick={onClear}>{copy.clear}</button> : null}
        {saving ? <span className="text-xs text-slate-500" role="status">…</span> : null}
      </div>
      {entries.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {entries.slice(0, SHOWN).map(({ node }) => (
            <li key={node.ref} className="inline-flex items-center gap-1 rounded-full border border-slate-300 py-0.5 ps-2.5 pe-1 text-xs dark:border-white/20">
              {node.name}
              <button type="button" className="h-5 w-5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10" aria-label={`${copy.untickThis}: ${node.name}`} onClick={() => onRemove(node.ref)}>×</button>
            </li>
          ))}
          {entries.length > SHOWN ? <li className="px-1 text-xs text-slate-600 dark:text-slate-300">+{entries.length - SHOWN}</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
