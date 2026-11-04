"use client";

import { useEffect, useState, useTransition } from "react";
import { changePlacesAction, editDraftAction, getDraftAction } from "@/lib/actions/project-setup-draft";
import { editSetupItemAction } from "@/lib/actions/project-setup";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { usePcwCopy } from "./usePcwCopy";
import { PLACE_LEVELS, levelLabel, listedNames, parentOptions, placeRows } from "../domain/places-view";
import { NotUsedToggle } from "./NotUsedToggle";
import { AcceptAllWaiting } from "./AcceptAllWaiting";
import { OriginBadge } from "./OriginBadge";

/**
 * Slide 5: where the project works. Names are suggested from a bundled list of places (never sent anywhere) but nothing is
 * guessed: the kind of place and what it sits inside are the person's choice. A project with no named places says so.
 */
export function PlacesSlide({ id, view, onView }: { id: string; view: SetupDraftView; onView: (v: SetupDraftView) => void }) {
  const pcw = usePcwCopy();
  const PCW_COPY = pcw.c;
  const c = PCW_COPY.places;
  const rows = placeRows(view.places);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [parent, setParent] = useState("");
  const [area, setArea] = useState(view.extras.projectArea ?? "");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const country = view.extras.start.country;

  // The bundled list of places loads only when someone types, so it never weighs on the first page.
  useEffect(() => {
    const q = name.trim();
    if (q.length < 2) { setSuggestions([]); return; }
    let alive = true;
    void import("@/features/workplan/domain/site-map").then(({ suggestPlaces }) => {
      if (!alive) return;
      const listed = listedNames(view.places);
      setSuggestions(suggestPlaces(q, country).filter((s) => !listed.has(s.trim().toLowerCase())));
    }).catch(() => {});
    return () => { alive = false; };
  }, [name, country, view.places]);

  const take = (v: SetupDraftView) => { setError(null); onView(v); };
  const run = (work: () => Promise<{ ok: true; value: SetupDraftView } | { ok: false; error: { message: string } }>) =>
    startTransition(async () => { const r = await work(); if (r.ok) take(r.value); else setError(r.error.message); });
  const decide = (path: string, op: "ACCEPT" | "REJECT") =>
    startTransition(async () => {
      const r = await editSetupItemAction(id, { area: "PLACES", path, op });
      if (!r.ok) return setError(r.error.message);
      const fresh = await getDraftAction(id);
      if (fresh.ok) take(fresh.value); else setError(fresh.error.message);
    });
  const edit = (path: string, patch: Record<string, unknown>) => run(() => changePlacesAction(id, { kind: "EDIT_PLACE", path, patch }));

  return (
    <div className="space-y-6">
      <AcceptAllWaiting id={id} area="PLACES" items={view.places} onView={onView} onError={setError} />
      {rows.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">{c.empty}</p> : (
        <ul className="space-y-1">
          {rows.map(({ item, place, inside }) => (
            <li key={item.path} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10">
              <input key={`n-${place.name}`} aria-label={c.name} defaultValue={place.name ?? ""} className="min-w-[10rem] flex-1 bg-transparent font-medium outline-none focus:underline" onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== place.name && edit(item.path, { name: e.target.value })} />
              <Select aria-label={c.level} className="!w-auto" value={place.adminLevel ?? ""} onChange={(e) => edit(item.path, { adminLevel: e.target.value === "" ? null : Number(e.target.value) })}>
                <option value="">{c.unknownLevel}</option>
                {PLACE_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </Select>
              <Select aria-label={c.parent} className="!w-auto" value={place.parentName ?? ""} onChange={(e) => edit(item.path, { parentName: e.target.value || null })}>
                <option value="">{c.none}</option>
                {parentOptions(view.places, place, place.adminLevel).map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
              <span className="text-xs text-slate-600 dark:text-slate-300">{levelLabel(place.adminLevel)}{inside ? ` · ${inside}` : ""}</span>
              <OriginBadge origin={item.origin} id={id} source={item.source} quote={item.quote} />
              {place.recognised ? <span className="w-full text-xs text-amber-900 dark:text-amber-300">{pcw.c.recognisedAs} {place.recognised.name}{place.recognised.within ? `, ${place.recognised.within}` : ""} ({place.recognised.source}). {pcw.c.recognisedCheck}</span> : null}
              {item.status === "PROPOSED" ? <button type="button" className="btn-secondary" disabled={pending} onClick={() => decide(item.path, "ACCEPT")}>{c.accept}</button> : null}
              <button type="button" className="btn-secondary" disabled={pending} onClick={() => decide(item.path, "REJECT")} aria-label={`${c.remove} ${place.name ?? ""}`}>{c.remove}</button>
            </li>
          ))}
        </ul>
      )}

      <fieldset className="grid gap-3 rounded-xl border border-dashed border-slate-300 p-4 sm:grid-cols-3 dark:border-white/20">
        <legend className="px-1 text-sm font-semibold">{c.add}</legend>
        <Field label={c.name}>
          <Input value={name} list="pcw-place-suggestions" onChange={(e) => setName(e.target.value)} />
        </Field>
        <datalist id="pcw-place-suggestions" aria-label={c.suggestions}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
        <Field label={c.level}>
          <Select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">{c.unknownLevel}</option>
            {PLACE_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </Select>
        </Field>
        <Field label={c.parent}>
          <Select value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">{c.none}</option>
            {parentOptions(view.places, null, level === "" ? null : Number(level)).map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-3">
          <button type="button" className="btn" disabled={pending || !name.trim()} onClick={() => { run(() => changePlacesAction(id, { kind: "ADD_PLACE", name, adminLevel: level === "" ? null : Number(level), parentName: parent || null })); setName(""); }}>{c.add}</button>
        </div>
      </fieldset>
      <NotUsedToggle id={id} view={view} requirement="places.decided" onView={onView} />

      <section aria-labelledby="pcw-area" className="grid gap-3 sm:grid-cols-2">
        <h2 id="pcw-area" className="sr-only">{c.areaSection}</h2>
        <Field label={c.area} description={c.areaHelp}>
          <Input value={area} onChange={(e) => setArea(e.target.value)} onBlur={() => area.trim() !== (view.extras.projectArea ?? "") && run(() => editDraftAction(id, { kind: "SET_PLACES_SETUP", patch: { projectArea: area.trim() || null } }))} />
        </Field>
        <Field label={c.boundary}>
          <Select value={view.extras.boundaryLevel ?? ""} onChange={(e) => run(() => editDraftAction(id, { kind: "SET_PLACES_SETUP", patch: { boundaryLevel: e.target.value === "" ? null : Number(e.target.value) } }))}>
            <option value="">{c.none}</option>
            {PLACE_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2"><NotUsedToggle id={id} view={view} requirement="places.area" onView={onView} /></div>
      </section>
      {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
    </div>
  );
}
