"use client";

import { useEffect, useMemo, useRef } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { someRefs, tickState, type PickRef, type Row, type Selection, type TickState } from "../domain/place-picker";
import type { PcwCopy } from "../copy";

type PlacesCopy = PcwCopy["places"];

/** One tickable line. The box is native: ticked, unticked, or "some inside" (the mixed state), and a ticked area's contents show as ticked and locked. */
function TreeLine({ row, state, lockedBy, showPath, active, open, copy, onTick, onOpen, onActive }: {
  row: Row; state: TickState; lockedBy: string; showPath: boolean; active: boolean; open: boolean; copy: PlacesCopy;
  onTick: () => void; onOpen: () => void; onActive: () => void;
}) {
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => { if (box.current) box.current.indeterminate = state === "SOME"; }, [state]);
  const locked = state === "INSIDE";
  return (
    <li role="treeitem" aria-expanded={row.canOpen ? open : undefined} aria-level={row.depth + 1} aria-selected={active}
      className={`flex items-center gap-1 rounded px-1 py-0.5 text-sm ${active ? "bg-brand-50 dark:bg-white/10" : ""}`} style={{ paddingInlineStart: `${row.depth * 1.1 + 0.25}rem` }}>
      {row.canOpen
        ? <button type="button" className="h-6 w-6 shrink-0 rounded text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10" aria-label={`${copy.openThis}: ${row.node.name}`} onClick={onOpen}><span aria-hidden="true" className="inline-block rtl:rotate-180" style={{ transform: open ? "rotate(90deg)" : undefined }}>▸</span></button>
        : <span className="inline-block h-6 w-6 shrink-0" />}
      <Checkbox ref={box} checked={state === "ON" || locked} disabled={locked} onChange={onTick} aria-label={row.node.name}
        title={locked ? copy.insideTicked(lockedBy) : state === "SOME" ? copy.partlyTicked : undefined} />
      <button type="button" className="min-w-0 flex-1 truncate text-start hover:underline" onClick={onActive}>{row.node.name}{showPath && row.ancestors.length > 0 ? <span className="ms-2 text-xs text-slate-600 dark:text-slate-300">{row.ancestors.map((a) => a.name).join(" › ")}</span> : null}</button>
    </li>
  );
}

/** The country's areas as a tree with ticks. Arrow keys come from the browser's own tab order: every line has a box and a name button. */
export function PlacePickTree({ rows, selection, activeRef, open, copy, showPath = false, onTick, onOpen, onActive }: {
  showPath?: boolean; rows: readonly Row[]; selection: Selection; activeRef: string | null; open: ReadonlySet<string>; copy: PlacesCopy;
  onTick: (node: PickRef, ancestors: readonly PickRef[]) => void; onOpen: (row: Row) => void; onActive: (row: Row) => void;
}) {
  const some = useMemo(() => someRefs(selection), [selection]);
  return (
    <ul role="tree" aria-label={copy.areasLabel} className="max-h-[26rem] space-y-0.5 overflow-y-auto pe-1">
      {rows.map((row) => (
        <TreeLine key={row.node.ref} row={row} state={tickState(selection, some, row.node, row.ancestors)} lockedBy={row.ancestors.find((a) => selection.has(a.ref))?.name ?? ""} showPath={showPath} active={activeRef === row.node.ref} open={open.has(row.node.ref)} copy={copy}
          onTick={() => onTick(row.node, row.ancestors)} onOpen={() => onOpen(row)} onActive={() => onActive(row)} />
      ))}
    </ul>
  );
}
