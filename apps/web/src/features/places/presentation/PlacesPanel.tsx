"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "@/lib/client/action-state";
import { createPlaceAction, importPlacesAction, setPlaceRetiredAction } from "@/lib/actions/places";
import type { PlaceImportPreview, PlaceItem, UnconfirmedLocations } from "@/lib/server/schemas-places";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { PLACES_COPY as C, PLACE_LEVEL_LABEL } from "../domain/places-copy";
import { DEFAULT_PLACE_COLUMNS, PLACE_COLUMNS, cellFor, filterPlaces, placesCsv, type PlaceColumn } from "../domain/places-table";
import { loadBoundaryFile, loadBoundaryManifest } from "@/lib/client/boundary-loader";
import { fileFor, findCountry, levelsFor } from "@/features/maps/domain/boundary-sources";
import { containingFeature } from "@/features/maps/domain/point-in-area";

interface Draft {
  name: string;
  adminLevel: string;
  parentId: string;
  aliases: string;
  code: string;
  latitude: string;
  longitude: string;
}
const EMPTY: Draft = { name: "", adminLevel: "2", parentId: "", aliases: "", code: "", latitude: "", longitude: "" };

const depthOf = (place: PlaceItem) => Math.max(0, place.path.split(" › ").length - 1);

/** The list of places, with adding, retiring, importing a sheet and the queue of typed words that match no place. */
export function PlacesPanel({ places, canEdit, unconfirmed }: { places: PlaceItem[]; canEdit: boolean; unconfirmed: UnconfirmedLocations | null }) {
  const router = useRouter();
  const add = useActionState();
  const retire = useActionState();
  const imp = useActionState();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [showRetired, setShowRetired] = useState(false);
  const [sheet, setSheet] = useState("");
  const [preview, setPreview] = useState<PlaceImportPreview | null>(null);

  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<number | null>(null);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [columns, setColumns] = useState<readonly PlaceColumn[]>(DEFAULT_PLACE_COLUMNS);
  const [inside, setInside] = useState<string | null>(null);

  const live = useMemo(() => places.filter((p) => !p.archived), [places]);
  const base = useMemo(() => (showRetired ? places : live), [places, live, showRetired]);
  const shown = useMemo(() => filterPlaces(base, { query, level: levelFilter, pinnedOnly }), [base, query, levelFilter, pinnedOnly]);
  const levelLabel = (l: number) => PLACE_LEVEL_LABEL[l] ?? String(l);
  const levelsPresent = useMemo(() => [...new Set(places.map((p) => p.adminLevel))].sort((a, b) => a - b), [places]);
  const retiredCount = places.length - live.length;
  const parents = useMemo(() => live.filter((p) => p.kind === "AREA"), [live]);
  // A suggestion only: where a typed pin falls among the bundled boundaries (never filled in for the person).
  useEffect(() => {
    setInside(null);
    const lat = Number(draft.latitude), lng = Number(draft.longitude);
    if (draft.latitude.trim() === "" || draft.longitude.trim() === "" || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const country = places.find((x) => x.id === draft.parentId)?.path.split(" › ").pop();
    if (!country) return;
    let live = true;
    void loadBoundaryManifest().then(async (m) => {
      const c = m ? findCountry(m, country) : null;
      const levels = levelsFor(c);
      const entry = levels.length ? fileFor(c, levels[levels.length - 1]!) : null;
      const file = entry ? await loadBoundaryFile(entry) : null;
      if (live && file) setInside(containingFeature(file.features as never, lat, lng));
    });
    return () => { live = false; };
  }, [draft.latitude, draft.longitude, draft.parentId, places]);

  const busy = add.busy || retire.busy || imp.busy;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const hasPin = draft.latitude.trim() !== "" || draft.longitude.trim() !== "";
    const out = await add.run(() =>
      createPlaceAction({
        name: draft.name,
        kind: hasPin ? "POINT" : "AREA",
        adminLevel: Number(draft.adminLevel),
        ...(draft.parentId ? { parentId: draft.parentId } : {}),
        aliases: draft.aliases.split(",").map((a) => a.trim()).filter(Boolean),
        ...(draft.code.trim() ? { code: draft.code.trim() } : {}),
        ...(draft.latitude.trim() !== "" ? { latitude: Number(draft.latitude) } : {}),
        ...(draft.longitude.trim() !== "" ? { longitude: Number(draft.longitude) } : {}),
      }),
    );
    if (out) {
      setDraft(EMPTY);
      router.refresh();
    }
  }

  async function toggle(place: PlaceItem) {
    const out = await retire.run(() => setPlaceRetiredAction(place.id, !place.archived));
    if (out) router.refresh();
  }

  async function check(apply: boolean) {
    const out = await imp.run(() => importPlacesAction({ text: sheet, apply }));
    if (!out) return;
    setPreview(out);
    if (out.applied) {
      setSheet("");
      router.refresh();
    }
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    setSheet(await file.text());
    setPreview(null);
  }

  return (
    <div className="mt-6 space-y-6">
      {unconfirmed && (
        <section className="card" aria-labelledby="confirm-title">
          <h2 id="confirm-title" className="text-sm font-semibold">{C.confirmTitle}</h2>
          {unconfirmed.items.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{C.confirmNone}</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{C.confirmIntro}</p>
              <ul className="mt-3 divide-y divide-slate-200 text-sm dark:divide-white/10">
                {unconfirmed.items.slice(0, 40).map((item) => (
                  <li key={item.text} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <span className="font-medium text-slate-800 dark:text-slate-100">{item.text}</span>
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                        {item.count}× · {item.sources.map((s) => C.sources[s] ?? s).join(", ")}
                      </span>
                      {item.status === "AMBIGUOUS" && (
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          {C.confirmAmbiguous} ({item.candidates?.map((c) => c.path).join("; ")})
                        </p>
                      )}
                    </div>
                    {canEdit && item.status === "UNRESOLVED" && (
                      <Button type="button" size="sm" variant="secondary" onClick={() => { set("name", item.text); document.getElementById("add-place-title")?.scrollIntoView({ behavior: "smooth" }); }}>
                        {C.add}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {canEdit ? (
        <section className="card" aria-labelledby="add-place-title">
          <h2 id="add-place-title" className="text-sm font-semibold">{C.addTitle}</h2>
          <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label={C.name} description={C.nameHint} error={add.fields?.name?.[0]}>
              <Input value={draft.name} onChange={(e) => set("name", e.target.value)} disabled={busy} />
            </Field>
            <Field label={C.kind} error={add.fields?.adminLevel?.[0]}>
              <Select value={draft.adminLevel} onChange={(e) => set("adminLevel", e.target.value)} disabled={busy}>
                {Object.entries(PLACE_LEVEL_LABEL).map(([level, label]) => <option key={level} value={level}>{label}</option>)}
              </Select>
            </Field>
            <Field label={C.inside} error={add.fields?.parentId?.[0]}>
              <Select value={draft.parentId} onChange={(e) => set("parentId", e.target.value)} disabled={busy}>
                <option value="">{C.insideNone}</option>
                {parents.map((p) => <option key={p.id} value={p.id}>{p.path}</option>)}
              </Select>
            </Field>
            <Field label={C.aliases} description={C.aliasesHint}>
              <Input value={draft.aliases} onChange={(e) => set("aliases", e.target.value)} disabled={busy} />
            </Field>
            <Field label={C.code}>
              <Input value={draft.code} onChange={(e) => set("code", e.target.value)} disabled={busy} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`${C.pin}: ${C.latitude}`} error={add.fields?.latitude?.[0]}>
                <Input inputMode="decimal" value={draft.latitude} onChange={(e) => set("latitude", e.target.value)} disabled={busy} />
              </Field>
              <Field label={C.longitude} error={add.fields?.longitude?.[0]}>
                <Input inputMode="decimal" value={draft.longitude} onChange={(e) => set("longitude", e.target.value)} disabled={busy} />
              </Field>
            </div>
            {inside && <p className="text-sm text-slate-600 sm:col-span-2 dark:text-slate-300">This pin falls inside <strong>{inside}</strong>. Add it below that area if it is listed.</p>}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy || draft.name.trim() === ""}>{add.busy ? C.adding : C.add}</Button>
              {add.error && <p role="alert" className="mt-2 text-sm text-danger-600">{add.error}</p>}
            </div>
          </form>
        </section>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">{C.viewerNote}</p>
      )}

      <section className="card" aria-labelledby="list-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="list-title" className="text-sm font-semibold">{C.listTitle}</h2>
          {retiredCount > 0 && (
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
              {C.showRetired} ({retiredCount})
            </label>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <Input aria-label="Search places" placeholder="Search places" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-56" />
          <Select aria-label="Level" value={levelFilter === null ? "" : String(levelFilter)} onChange={(e) => setLevelFilter(e.target.value === "" ? null : Number(e.target.value))}>
            <option value="">All levels</option>
            {levelsPresent.map((l) => <option key={l} value={l}>{levelLabel(l)}</option>)}
          </Select>
          <label className="flex items-center gap-1"><input type="checkbox" checked={pinnedOnly} onChange={(e) => setPinnedOnly(e.target.checked)} /> With a pin</label>
          <details className="relative">
            <summary className="cursor-pointer select-none">Columns</summary>
            <div className="absolute z-10 mt-1 space-y-1 rounded-lg border bg-white p-2 shadow dark:bg-slate-900">
              {PLACE_COLUMNS.map((c) => (
                <label key={c.key} className="flex items-center gap-1"><input type="checkbox" checked={columns.includes(c.key)} onChange={() => setColumns((cur) => (cur.includes(c.key) ? cur.filter((k) => k !== c.key) : PLACE_COLUMNS.map((x) => x.key).filter((k) => k === c.key || cur.includes(k))))} /> {c.label}</label>
              ))}
            </div>
          </details>
          <a className="ms-auto underline" href={`data:text/csv;charset=utf-8,${encodeURIComponent(placesCsv(shown, columns, levelLabel))}`} download="places.csv">Download CSV</a>
        </div>
        <p className="mt-1 text-xs text-slate-500">{shown.length} of {base.length} places</p>
        {shown.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{base.length === 0 ? C.empty : "No place matches."}</p>
        ) : (
          <ul className="mt-3 text-sm">
            {shown.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5 last:border-0 dark:border-white/5" style={{ paddingLeft: `${depthOf(p) * 1.25}rem` }}>
                <span className={p.archived ? "text-slate-400 line-through dark:text-slate-500" : "text-slate-800 dark:text-slate-100"}>
                  {p.name}
                  <span className="ml-2 text-xs text-slate-500 no-underline dark:text-slate-400">
                    {columns.map((c) => cellFor(p, c, levelLabel)).filter(Boolean).join(" · ")}
                    {p.archived ? ` · ${C.retiredTag}` : ""}
                  </span>
                </span>
                {canEdit && (
                  <button type="button" className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300" disabled={busy} onClick={() => toggle(p)}>
                    {p.archived ? C.restore : C.retire}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {retire.error && <p role="alert" className="mt-2 text-sm text-danger-600">{retire.error}</p>}
      </section>

      {canEdit && (
        <section className="card" aria-labelledby="import-title">
          <h2 id="import-title" className="text-sm font-semibold">{C.importTitle}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{C.importIntro}</p>
          <div className="mt-3 space-y-3">
            <input type="file" accept=".csv,.tsv,.txt" onChange={(e) => readFile(e.target.files?.[0])} className="block w-full text-sm text-slate-700 dark:text-slate-200" disabled={busy} aria-label={C.importTitle} />
            <Field label={C.importTitle}>
              <Textarea rows={6} value={sheet} onChange={(e) => { setSheet(e.target.value); setPreview(null); }} disabled={busy} dictate />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" disabled={busy || sheet.trim() === ""} onClick={() => check(false)}>{C.importPreview}</Button>
              {preview && preview.problems.length === 0 && preview.create.length > 0 && !preview.applied && (
                <Button type="button" disabled={busy} onClick={() => check(true)}>{C.importApply}</Button>
              )}
            </div>
            {imp.error && <p role="alert" className="text-sm text-danger-600">{imp.error}</p>}
            {preview && (
              <div className="text-sm" aria-live="polite">
                {preview.problems.length > 0 ? (
                  <ul className="list-disc pl-5 text-danger-600">
                    {preview.problems.map((p) => <li key={`${p.row}-${p.message}`}>{C.importProblem(p.row, p.message)}</li>)}
                  </ul>
                ) : preview.applied ? (
                  <p className="text-emerald-700 dark:text-emerald-300">{C.importAdded(preview.create.length)}</p>
                ) : (
                  <>
                    <p>{C.importWillAdd(preview.create.length)} {preview.skipped.length > 0 ? C.importSkipped(preview.skipped.length) : ""}</p>
                    <ul className="mt-1 list-disc pl-5 text-slate-600 dark:text-slate-300">
                      {preview.create.slice(0, 30).map((c) => <li key={c.path}>{c.path}</li>)}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
