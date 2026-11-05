"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { changePlacesAction } from "@/lib/actions/project-setup-draft";
import { loadBoundaryManifest } from "@/lib/client/boundary-loader";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import type { PlaceDef } from "@donordesk/domain";
import type { BoundaryUnit } from "../../../maps/domain/boundaries/join";
import {
  EMPTY_SELECTION, entryFor, focusUnits, matchDocumentPlaces, refOf, searchAreas, visibleRows, selectionFromPlaces, someRefs, tickState, toPicks, toggle,
  type LevelUnits, type PickRef, type Row, type Selection,
} from "../domain/place-picker";
import { usePcwCopy } from "./usePcwCopy";
import type { PcwCopy } from "../copy";
import { usePlaceLevels } from "./usePlaceLevels";
import { PlacePickTree } from "./PlacePickTree";
import { PlacePickMap } from "./PlacePickMap";
import { TickedChips } from "./TickedChips";

const defOf = (item: SetupDraftView["places"][number]): PlaceDef => item.value as PlaceDef;

/**
 * Slide 5, the picker: the country's areas as a ticked list on one side and the map on the other. Ticking is the whole job: every change is
 * saved to the draft at once (the draft's places, with their parents), so the Work plan slide can offer them with no further step.
 */
export function PlacePicker({ id, view, onView, onError }: { id: string; view: SetupDraftView; onView: (v: SetupDraftView) => void; onError: (m: string | null) => void }) {
  const c = usePcwCopy().c.places;
  const defs = useMemo(() => view.places.map(defOf), [view.places]);
  const [country, setCountry] = useState<string>(() => defs.find((p) => p.mapRef && p.adminLevel === 0)?.name ?? view.extras.start.country ?? "");
  const [countries, setCountries] = useState<string[]>([]);
  const [selection, setSelection] = useState<Selection>(() => selectionFromPlaces(defs));
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [focus, setFocus] = useState<Row | null>(null);
  const [active, setActive] = useState<Row | null>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const lv = usePlaceLevels(country || null);
  const insideCache = useMemo(() => new Map<string, BoundaryUnit[]>(), [lv.units]);

  useEffect(() => { void loadBoundaryManifest().then((m) => setCountries((m?.countries ?? []).map((x) => x.name).sort((a, b) => a.localeCompare(b)))); }, []);

  // One save at a time; a tick made while saving is sent next, so the last tick always wins and none is lost.
  const latest = useRef<{ country: string; selection: Selection } | null>(null);
  const busy = useRef(false);
  async function flush() {
    if (busy.current) return;
    busy.current = true;
    try {
      while (latest.current) {
        const job = latest.current;
        latest.current = null;
        const r = await changePlacesAction(id, { kind: "SET_BOUNDARY_PLACES", country: { name: job.country }, units: toPicks(job.selection) });
        if (r.ok) { onError(null); onView(r.value); } else onError(r.error.message);
      }
    } finally { busy.current = false; setSaving(false); }
  }
  const commit = (next: Selection, inCountry = country) => { setSelection(next); latest.current = { country: inCountry, selection: next }; setSaving(true); void flush(); };

  const rows = useMemo(() => (lv.status === "ready" ? visibleRows(lv.levels, lv.units, open, insideCache) : []), [lv.status, lv.levels, lv.units, open, insideCache]);
  const shown = useMemo(() => focusUnits(lv.levels, lv.units, focus, insideCache), [lv.levels, lv.units, focus, insideCache]);
  const some = useMemo(() => someRefs(selection), [selection]);
  const crumbs: PickRef[] = focus ? [...focus.ancestors, focus.node] : [];
  const stateOfUnit = (u: BoundaryUnit) => tickState(selection, some, refOf(u, shown?.level ?? 0, crumbs[crumbs.length - 1] ?? null), crumbs);

  async function openRow(row: Row) {
    const isOpen = open.has(row.node.ref);
    setOpen((cur) => { const n = new Set(cur); if (isOpen) n.delete(row.node.ref); else n.add(row.node.ref); return n; });
    if (isOpen) { setFocus(parentRow(row, lv.units)); return; }
    setFocus(row);
    const next = lv.levels.find((l) => l > row.node.level);
    if (next !== undefined) await lv.ensure(next);
  }
  const chooseOnMap = (ref: string | null) => {
    const unit = ref ? shown?.list.find((u) => u.ref === ref) : undefined;
    setActive(unit && shown ? { node: refOf(unit, shown.level, crumbs[crumbs.length - 1] ?? null), unit, ancestors: crumbs, depth: crumbs.length, canOpen: lv.levels.some((l) => l > shown.level) } : null);
  };
  const tick = (node: PickRef, ancestors: readonly PickRef[]) => commit(toggle(selection, node, ancestors));
  const refocus = (i: number) => {
    if (i < 0) { setFocus(null); return; }
    const node = crumbs[i]!;
    const unit = lv.units.get(node.level)?.find((u) => u.ref === node.ref);
    if (unit) setFocus({ node, unit, ancestors: crumbs.slice(0, i), depth: i, canOpen: true });
  };

  // Search needs every level, so it loads them the first time someone types.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setFound([]); return; }
    let live = true;
    void lv.ensureAll().then((all) => {
      if (!live) return;
      setFound(searchAreas(all, q).map(({ unit, level }) => { const e = entryFor(unit, level, all); return { node: e.node, unit, ancestors: e.chain, depth: 0, canOpen: false }; }));
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, lv.status, lv.levels]);

  const waiting = useMemo(() => view.places.map((item, index) => ({ item, index })).filter(({ item }) => !defOf(item).mapRef && item.status === "PROPOSED" && defOf(item).name), [view.places]);
  async function matchDocuments() {
    const all: LevelUnits = await lv.ensureAll();
    const { matched, unmatched } = matchDocumentPlaces(waiting.map((w) => ({ index: w.index, place: defOf(w.item) })), all);
    let next = selection;
    for (const m of matched) { const e = entryFor(m.found.unit, m.found.level, all); next = toggle(next, e.node, e.chain); }
    commit(next);
    setNote(c.matchedLine(matched.length, unmatched.length));
  }

  const body = lv.status === "none" ? <p className="text-sm text-slate-700 dark:text-slate-200">{country ? c.noBoundaries : c.chooseCountry}</p> : lv.status === "loading" || lv.status === "idle" ? <p className="text-sm text-slate-600 dark:text-slate-300">{country ? c.loading : ""}</p> : (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <Field label={c.search}><Input value={query} onChange={(e) => setQuery(e.target.value)} type="search" /></Field>
        {query.trim().length >= 2
          ? (found.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">{c.searchNone}</p> : <PlacePickTree showPath rows={found} selection={selection} activeRef={active?.node.ref ?? null} open={open} copy={c} onTick={tick} onOpen={() => {}} onActive={setActive} />)
          : <PlacePickTree rows={rows} selection={selection} activeRef={active?.node.ref ?? null} open={open} copy={c} onTick={tick} onOpen={(r) => void openRow(r)} onActive={setActive} />}
      </div>
      <div className="space-y-2">
        <nav aria-label={c.areasLabel} className="flex flex-wrap items-center gap-1 text-sm">
          <button type="button" className="font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={() => refocus(-1)}>{c.wholeCountry}</button>
          {crumbs.map((cr, i) => <span key={cr.ref} className="flex items-center gap-1"><span aria-hidden="true">›</span><button type="button" className="hover:underline" onClick={() => refocus(i)}>{cr.name}</button></span>)}
        </nav>
        <PlacePickMap units={shown?.list ?? []} stateOf={stateOfUnit} activeRef={active?.node.ref ?? null} label={`${c.pickTitle}: ${country}`} copy={c} onChoose={chooseOnMap} />
        {active ? <ActiveCard row={active} selection={selection} some={some} copy={c} onTick={() => tick(active.node, active.ancestors)} onOpen={() => void openRow(active)} /> : null}
      </div>
    </div>
  );

  return (
    <section aria-labelledby="pcw-pick" className="space-y-4">
      <div>
        <h2 id="pcw-pick" className="text-base font-semibold">{c.pickTitle}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">{c.pickHelp}</p>
      </div>
      <div className="max-w-sm">
        <Field label={c.country}>
          <Select value={country} onChange={(e) => { setCountry(e.target.value); setOpen(new Set()); setFocus(null); setActive(null); setQuery(""); commit(EMPTY_SELECTION, e.target.value); }}>
            <option value="">{c.chooseCountry}</option>
            {country && !countries.includes(country) ? <option value={country}>{country}</option> : null}
            {countries.map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </Field>
      </div>
      {waiting.length > 0 && lv.status === "ready" ? <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-500/40 dark:bg-amber-500/10"><span>{c.matchDocs(waiting.length)}</span><button type="button" className="btn-secondary" onClick={() => void matchDocuments()}>{c.matchButton}</button></div> : null}
      {note ? <p role="status" className="text-sm text-slate-700 dark:text-slate-200">{note}</p> : null}
      {body}
      <TickedChips selection={selection} copy={c} saving={saving} onRemove={(ref) => { const e = selection.get(ref); if (e) commit(toggle(selection, e.node, e.chain)); }} onClear={() => commit(EMPTY_SELECTION)} />
    </section>
  );
}

/** The row above `row`, found from the levels already loaded (null at the first level). */
function parentRow(row: Row, units: LevelUnits): Row | null {
  const parent = row.ancestors[row.ancestors.length - 1];
  const unit = parent ? units.get(parent.level)?.find((u) => u.ref === parent.ref) : undefined;
  return parent && unit ? { node: parent, unit, ancestors: row.ancestors.slice(0, -1), depth: row.depth - 1, canOpen: true } : null;
}

function ActiveCard({ row, selection, some, copy, onTick, onOpen }: { row: Row; selection: Selection; some: ReadonlySet<string>; copy: PcwCopy["places"]; onTick: () => void; onOpen: () => void }) {
  const state = tickState(selection, some, row.node, row.ancestors);
  const locked = state === "INSIDE";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10" role="status">
      <span className="font-medium">{row.node.name}</span>
      <span className="text-xs text-slate-600 dark:text-slate-300">{row.ancestors.map((a) => a.name).join(" › ")}</span>
      <span className="ms-auto flex gap-2">
        <button type="button" className="btn" disabled={locked} onClick={onTick}>{state === "ON" ? copy.untickThis : copy.tickThis}</button>
        {row.canOpen ? <button type="button" className="btn-secondary" onClick={onOpen}>{copy.openThis}</button> : null}
      </span>
      {locked ? <span className="w-full text-xs text-slate-600 dark:text-slate-300">{copy.insideTicked(row.ancestors.find((a) => selection.has(a.ref))?.name ?? "")}</span> : null}
    </div>
  );
}
