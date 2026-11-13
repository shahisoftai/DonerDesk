"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { seedPlacesFromBoundariesAction } from "@/lib/actions/places";
import { loadBoundaryManifest } from "@/lib/client/boundary-loader";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { EMPTY_SELECTION, entryFor, focusUnits, marksFor, refOf, someRefs, tickState, toPicks, toggle, visibleRows, type PickEntry, type Row, type Selection } from "../../project-setup/pcw/domain/place-picker";
import { usePlaceLevels } from "../../project-setup/pcw/presentation/usePlaceLevels";
import { usePcwCopy } from "../../project-setup/pcw/presentation/usePcwCopy";
import { PlacePickTree } from "../../project-setup/pcw/presentation/PlacePickTree";
import { PlacePickMap } from "../../project-setup/pcw/presentation/PlacePickMap";
import type { BoundaryUnit } from "../../maps/domain/boundaries/join";
import { listedRefs, seedUnitsFor, type ListedPlace } from "../domain/area-ticks";

/**
 * Where we work, by ticking (Phase 53.4): the country's areas as a list beside a map, the same tree and map the project wizard uses. Areas
 * already in the places list show ticked; ticking another adds it (and the areas above it) to the list at once through the ordinary boundary
 * import. Removing a place is done in Settings → Places, because another project may use it.
 */
export function ProjectAreaPicker({ initialCountry, places, canEdit }: { initialCountry: string; places: readonly ListedPlace[]; canEdit: boolean }) {
  const { c } = usePcwCopy();
  const copy = c.places;
  const router = useRouter();
  const [country, setCountry] = useState(initialCountry);
  const [countries, setCountries] = useState<string[]>([]);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [focus, setFocus] = useState<Row | null>(null);
  const [active, setActive] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const lv = usePlaceLevels(country || null);
  const cache = useMemo(() => new Map<string, BoundaryUnit[]>(), [lv.units]);
  useEffect(() => { void loadBoundaryManifest().then((m) => setCountries((m?.countries ?? []).map((x) => x.name).sort((a, b) => a.localeCompare(b)))); }, []);

  // What the places list already holds, shown ticked as each level loads.
  const listed = useMemo(() => listedRefs(lv.units, places), [lv.units, places]);
  const selection = useMemo<Selection>(() => {
    const out = new Map<string, PickEntry>();
    for (const [level, list] of lv.units) for (const u of list) if (listed.has(u.ref)) { const e = entryFor(u, level, lv.units); out.set(e.node.ref, e); }
    return out;
  }, [lv.units, listed]);
  const some = useMemo(() => someRefs(selection), [selection]);
  const rows = useMemo(() => (lv.status === "ready" ? visibleRows(lv.levels, lv.units, open, cache) : []), [lv.status, lv.levels, lv.units, open, cache]);
  const shown = useMemo(() => focusUnits(lv.levels, lv.units, focus, cache), [lv.levels, lv.units, focus, cache]);
  const marks = useMemo(() => marksFor(selection, lv.units, shown?.level ?? 0, focus?.node.ref ?? null), [selection, lv.units, shown, focus]);
  const crumbs = focus ? [...focus.ancestors, focus.node] : [];

  async function tick(node: Row["node"], ancestors: Row["ancestors"]) {
    if (!canEdit || saving) return;
    if (selection.has(node.ref)) { setNote(`${node.name} is already in your places list. To take it out, retire it under Settings → Places (another project may use it).`); return; }
    const next = toggle(EMPTY_SELECTION, node, ancestors);
    setSaving(true); setNote(null);
    const r = await seedPlacesFromBoundariesAction({ country: { name: country }, units: seedUnitsFor(toPicks(next)), apply: true });
    setSaving(false);
    if (!r.ok) { setNote(r.error.message); return; }
    setNote(`${node.name} was added to your places.`);
    router.refresh();
  }
  async function openRow(row: Row) {
    const isOpen = open.has(row.node.ref);
    setOpen((cur) => { const n = new Set(cur); if (isOpen) n.delete(row.node.ref); else n.add(row.node.ref); return n; });
    setFocus(isOpen ? null : row);
    const next = lv.levels.find((l) => l > row.node.level);
    if (!isOpen && next !== undefined) await lv.ensure(next);
  }
  const chooseOnMap = (ref: string | null) => {
    const unit = ref ? shown?.list.find((u) => u.ref === ref) : undefined;
    setActive(unit && shown ? { node: refOf(unit, shown.level, crumbs[crumbs.length - 1] ?? null), unit, ancestors: crumbs, depth: crumbs.length, canOpen: lv.levels.some((l) => l > shown.level) } : null);
  };
  const stateOfUnit = (u: BoundaryUnit) => tickState(selection, some, refOf(u, shown?.level ?? 0, crumbs[crumbs.length - 1] ?? null), crumbs);

  return (
    <section className="space-y-4" aria-label="Areas where this project works" data-testid="project-area-picker">
      <p className="text-sm text-slate-600 dark:text-slate-300">Tick the areas where this project works. They go straight into your places list, spelled the way the maps expect.</p>
      <div className="max-w-sm">
        <Field label={copy.country}>
          <Select value={country} onChange={(e) => { setCountry(e.target.value); setOpen(new Set()); setFocus(null); setActive(null); }}>
            <option value="">{copy.chooseCountry}</option>
            {country && !countries.includes(country) ? <option value={country}>{country}</option> : null}
            {countries.map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </Field>
      </div>
      {note ? <p role="status" className="text-sm text-slate-700 dark:text-slate-200">{note}</p> : null}
      {lv.status === "none" ? <p className="text-sm">{country ? copy.noBoundaries : copy.chooseCountry}</p>
        : lv.status !== "ready" ? <p className="text-sm text-slate-600 dark:text-slate-300">{country ? copy.loading : ""}</p>
        : (
          <div className="grid gap-4 lg:grid-cols-2">
            <PlacePickTree rows={rows} selection={selection} activeRef={active?.node.ref ?? null} open={open} copy={copy} onTick={(n, a) => void tick(n, a)} onOpen={(r) => void openRow(r)} onActive={setActive} />
            <div className="space-y-2">
              <PlacePickMap marks={marks} units={shown?.list ?? []} stateOf={stateOfUnit} activeRef={active?.node.ref ?? null} label={`${copy.pickTitle}: ${country}`} copy={copy} onChoose={chooseOnMap} />
              {active && canEdit ? <button type="button" className="btn-primary" disabled={saving || selection.has(active.node.ref)} onClick={() => void tick(active.node, active.ancestors)}>{selection.has(active.node.ref) ? `${active.node.name} is in your places` : `${copy.tickThis}: ${active.node.name}`}</button> : null}
            </div>
          </div>
        )}
      <p className="text-sm" aria-live="polite">{saving ? "Adding…" : `${selection.size} areas of ${country || "this country"} are in your places list.`}</p>
    </section>
  );
}
