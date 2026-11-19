"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { changePlacesAction } from "@/lib/actions/project-setup-draft";
import { loadBoundaryManifest } from "@/lib/client/boundary-loader";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { PLACE_LEVEL_LABEL } from "@/features/places/domain/places-copy";
import { Field } from "@/components/ui/Field";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import type { PlaceDef } from "@donordesk/domain";
import type { BoundaryUnit } from "../../../maps/domain/boundaries/join";
import {
  EMPTY_SELECTION, addAll, entryFor, focusUnits, levelRows, marksFor, matchDocumentPlaces, matchPastedNames, refOf, searchAreas, visibleRows, selectionFromPlaces, someRefs, tickState, toPicks, toggle,
  type LevelUnits, type PickRef, type Row, type Selection,
} from "../domain/place-picker";
import { usePcwCopy } from "./usePcwCopy";
import { usePlaceLevels } from "./usePlaceLevels";
import { PlacePickTree } from "./PlacePickTree";
import { PlacePickMap } from "./PlacePickMap";
import { TickedChips } from "./TickedChips";

const defOf = (item: SetupDraftView["places"][number]): PlaceDef => item.value as PlaceDef;

/**
 * Slide 5, the picker: the country's areas as a ticked list on one side and the map on the other. Ticking is the whole job: every change is
 * saved to the draft at once (the draft's places, with their parents), so the Work plan slide can offer them with no further step.
 */
export function PlacePicker({ id, view, onView, onError, find }: { id: string; view: SetupDraftView; onView: (v: SetupDraftView) => void; onError: (m: string | null) => void; find?: { text: string; nonce: number } | null }) {
  const c = usePcwCopy().c.places;
  const defs = useMemo(() => view.places.map(defOf), [view.places]);
  const [country, setCountry] = useState<string>(() => defs.find((p) => p.mapRef && p.adminLevel === 0)?.name ?? view.extras.start.country ?? "");
  const [countries, setCountries] = useState<string[]>([]);
  const [selection, setSelection] = useState<Selection>(() => selectionFromPlaces(defs));
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [focus, setFocus] = useState<Row | null>(null);
  // One whole level at a time (null = the tree, opened area by area), and the box where a list of names is pasted.
  const [levelView, setLevelView] = useState<number | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const lv = usePlaceLevels(country || null);
  const insideCache = useMemo(() => new Map<string, BoundaryUnit[]>(), [lv.units]);

  // "Find on the map" from the other places: the name goes into the search box and the box is brought into view.
  const searchBox = useRef<HTMLDivElement>(null);
  useEffect(() => { if (find) { setQuery(find.text); searchBox.current?.scrollIntoView({ block: "center", behavior: "smooth" }); } }, [find]);
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

  const flat = useMemo(() => (levelView !== null && lv.status === "ready" ? levelRows(levelView, lv.units) : null), [levelView, lv.status, lv.units]);
  const flatByRef = useMemo(() => new Map((flat ?? []).map((r) => [r.node.ref, r])), [flat]);
  const rows = useMemo(() => (flat ?? (lv.status === "ready" ? visibleRows(lv.levels, lv.units, open, insideCache) : [])), [flat, lv.status, lv.levels, lv.units, open, insideCache]);
  const shown = useMemo(() => (levelView !== null ? (lv.units.get(levelView) ? { level: levelView, list: [...lv.units.get(levelView)!] } : null) : focusUnits(lv.levels, lv.units, focus, insideCache)), [levelView, lv.levels, lv.units, focus, insideCache]);
  const some = useMemo(() => someRefs(selection), [selection]);
  // A ticked area finer than the level on screen is shown as a point; its level loads when something is ticked in it.
  const tickedLevels = useMemo(() => [...new Set([...selection.values()].map((e) => e.node.level))].join(","), [selection]);
  useEffect(() => { for (const l of tickedLevels.split(",").filter(Boolean)) void lv.ensure(Number(l)); }, [tickedLevels, lv.status]);
  const marks = useMemo(() => marksFor(selection, lv.units, shown?.level ?? 0, levelView !== null ? null : focus?.node.ref ?? null), [selection, lv.units, shown, focus, levelView]);
  const crumbs: PickRef[] = focus ? [...focus.ancestors, focus.node] : [];
  const rowOfUnit = (u: BoundaryUnit): Row | null => {
    const flatRow = flatByRef.get(u.ref);
    if (flatRow) return flatRow;
    if (!shown || levelView !== null) return null;
    return { node: refOf(u, shown.level, crumbs[crumbs.length - 1] ?? null), unit: u, ancestors: crumbs, depth: crumbs.length, canOpen: false };
  };
  const stateOfUnit = (u: BoundaryUnit) => { const r = rowOfUnit(u); return r ? tickState(selection, some, r.node, r.ancestors) : "OFF"; };

  async function openRow(row: Row) {
    const isOpen = open.has(row.node.ref);
    setOpen((cur) => { const n = new Set(cur); if (isOpen) n.delete(row.node.ref); else n.add(row.node.ref); return n; });
    if (isOpen) { setFocus(parentRow(row, lv.units)); return; }
    setFocus(row);
    const next = lv.levels.find((l) => l > row.node.level);
    if (next !== undefined) await lv.ensure(next);
  }
  // A click on an area of the map is the same as a click on its name: it ticks or unticks it.
  const tickOnMap = (ref: string | null) => {
    const unit = ref ? shown?.list.find((u) => u.ref === ref) : undefined;
    const row = unit ? rowOfUnit(unit) : null;
    if (row) tick(row.node, row.ancestors);
  };
  // Everything on screen (the areas of the level, or of the open area) in one go; what is already covered stays as it is.
  const visibleAreas = (): Row[] => (levelView !== null ? (flat ?? []) : (shown?.list ?? []).map((u) => rowOfUnit(u)!).filter(Boolean));
  const allCovered = visibleAreas().every((r) => tickState(selection, some, r.node, r.ancestors) !== "OFF" && tickState(selection, some, r.node, r.ancestors) !== "SOME");
  const selectAllShown = () => commit(addAll(selection, visibleAreas()));
  async function chooseLevel(value: string) {
    if (value === "") { setLevelView(null); return; }
    const level = Number(value);
    await lv.ensureAll();
    setLevelView(level); setQuery("");
  }
  async function addPasted() {
    const all: LevelUnits = await lv.ensureAll();
    const { matched, unmatched } = matchPastedNames(pasteText, all);
    commit(addAll(selection, matched.map((f) => { const e = entryFor(f.unit, f.level, all); return { node: e.node, ancestors: e.chain }; })));
    setPasteText(unmatched.join("\n"));
    setNote(c.pastedLine(matched.length, unmatched.length));
    if (unmatched.length === 0) setPasteOpen(false);
  }
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
    // An area already ticked stays ticked: toggling it again would untick it.
    for (const m of matched) { const e = entryFor(m.found.unit, m.found.level, all); if (!next.has(e.node.ref)) next = toggle(next, e.node, e.chain); }
    commit(next);
    setNote(c.matchedLine(matched.length, unmatched.length));
  }

  const levelSwitch = lv.levels.length > 1 ? (
    <Field label={c.showLevel}>
      <Select value={levelView === null ? "" : String(levelView)} onChange={(e) => void chooseLevel(e.target.value)}>
        <option value="">{c.levelByArea}</option>
        {lv.levels.map((l) => <option key={l} value={l}>{c.levelAll(PLACE_LEVEL_LABEL[l] ?? String(l))}</option>)}
      </Select>
    </Field>
  ) : null;
  const bulk = (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn-secondary btn-sm" disabled={allCovered || (shown?.list.length ?? 0) === 0} onClick={selectAllShown}>{levelView === null && focus ? c.selectAllIn(focus.node.name) : c.selectAll}</button>
      <button type="button" className="btn-ghost btn-sm" disabled={selection.size === 0} onClick={() => commit(EMPTY_SELECTION)}>{c.clear}</button>
      <button type="button" className="btn-ghost btn-sm ms-auto" aria-expanded={pasteOpen} onClick={() => setPasteOpen((v) => !v)}>{c.pasteNames}</button>
    </div>
  );
  const pasteBox = pasteOpen ? (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <Field label={c.pasteLabel}><Textarea rows={5} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={c.pastePlaceholder} /></Field>
      <button type="button" className="btn-secondary btn-sm" disabled={pasteText.trim().length === 0} onClick={() => void addPasted()}>{c.pasteAdd}</button>
    </div>
  ) : null;

  const body = lv.status === "none" ? <p className="text-sm text-slate-700 dark:text-slate-200">{country ? c.noBoundaries : c.chooseCountry}</p> : lv.status === "loading" || lv.status === "idle" ? <p className="text-sm text-slate-600 dark:text-slate-300">{country ? c.loading : ""}</p> : (
    <div className="space-y-3">
      <div className="grid items-end gap-3 sm:grid-cols-2">{levelSwitch}{bulk}</div>
      {pasteBox}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3" ref={searchBox}>
          <Field label={c.search}><Input value={query} onChange={(e) => setQuery(e.target.value)} type="search" /></Field>
          {query.trim().length >= 2
            ? (found.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">{c.searchNone}</p> : <PlacePickTree showPath rows={found} selection={selection} open={open} copy={c} onTick={tick} onOpen={() => {}} />)
            : <PlacePickTree showPath={levelView !== null} rows={rows} selection={selection} open={open} copy={c} onTick={tick} onOpen={(r) => void openRow(r)} />}
        </div>
        <div className="space-y-2">
          {levelView === null ? (
            <nav aria-label={c.areasLabel} className="flex flex-wrap items-center gap-1 text-sm">
              <button type="button" className="font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={() => refocus(-1)}>{c.wholeCountry}</button>
              {crumbs.map((cr, i) => <span key={cr.ref} className="flex items-center gap-1"><span aria-hidden="true">›</span><button type="button" className="hover:underline" onClick={() => refocus(i)}>{cr.name}</button></span>)}
            </nav>
          ) : null}
          <PlacePickMap marks={marks} units={shown?.list ?? []} stateOf={stateOfUnit} activeRef={null} label={`${c.pickTitle}: ${country}`} copy={c} onChoose={tickOnMap} />
        </div>
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
          <Select value={country} onChange={(e) => { setCountry(e.target.value); setOpen(new Set()); setFocus(null); setLevelView(null); setQuery(""); commit(EMPTY_SELECTION, e.target.value); }}>
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
