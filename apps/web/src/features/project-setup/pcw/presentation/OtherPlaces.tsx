"use client";

import { useState, useTransition } from "react";
import { changePlacesAction, getDraftAction } from "@/lib/actions/project-setup-draft";
import { editSetupItemAction } from "@/lib/actions/project-setup";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { PlaceDef } from "@donordesk/domain";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { PLACE_LEVELS, levelLabel } from "../domain/places-view";
import { OriginBadge } from "./OriginBadge";
import { usePcwCopy } from "./usePcwCopy";

/**
 * Places that are not areas on the map: a camp, a clinic, a village, or a name a document gave that the map did not match. They keep the
 * old controls (confirm, remove, say what kind), and a new one is just a name and, if known, what it is inside; its kind follows from that.
 */
export function OtherPlaces({ id, view, onView, onError }: { id: string; view: SetupDraftView; onView: (v: SetupDraftView) => void; onError: (m: string | null) => void }) {
  const pcw = usePcwCopy();
  const c = pcw.c.places;
  const [name, setName] = useState("");
  const [inside, setInside] = useState("");
  const [pending, start] = useTransition();
  const rows = view.places.filter((i) => !(i.value as PlaceDef).mapRef && i.status !== "REJECTED");
  const parents = view.places.map((i) => i.value as PlaceDef).filter((p) => p.name && p.adminLevel !== null && p.adminLevel < 4 && view.places.find((i) => i.value === p)?.status !== "REJECTED");

  const take = (v: SetupDraftView) => { onError(null); onView(v); };
  const run = (work: () => Promise<{ ok: true; value: SetupDraftView } | { ok: false; error: { message: string } }>) =>
    start(async () => { const r = await work(); if (r.ok) take(r.value); else onError(r.error.message); });
  const decide = (path: string, op: "ACCEPT" | "REJECT") => start(async () => {
    const r = await editSetupItemAction(id, { area: "PLACES", path, op });
    if (!r.ok) return onError(r.error.message);
    const fresh = await getDraftAction(id);
    if (fresh.ok) take(fresh.value); else onError(fresh.error.message);
  });
  const add = () => {
    const parent = parents.find((p) => p.name === inside);
    run(() => changePlacesAction(id, { kind: "ADD_PLACE", name, adminLevel: parent ? Math.min((parent.adminLevel ?? 3) + 1, 4) : 4, parentName: parent?.name ?? null }));
    setName(""); setInside("");
  };

  return (
    <section aria-labelledby="pcw-other" className="space-y-3">
      <div>
        <h2 id="pcw-other" className="text-base font-semibold">{c.otherTitle}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">{c.otherHelp}</p>
      </div>
      {rows.length > 0 ? (
        <ul className="space-y-1">
          {rows.map((item) => {
            const place = item.value as PlaceDef;
            return (
              <li key={item.path} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10">
                <span className="min-w-[10rem] flex-1 font-medium">{place.name}{place.parentName ? <span className="ms-2 text-xs font-normal text-slate-600 dark:text-slate-300">{place.parentName}</span> : null}</span>
                {place.adminLevel === null
                  ? <Select aria-label={c.level} className="!w-auto" value="" disabled={pending} onChange={(e) => e.target.value !== "" && run(() => changePlacesAction(id, { kind: "EDIT_PLACE", path: item.path, patch: { adminLevel: Number(e.target.value) } }))}>
                      <option value="">{c.unknownLevel}</option>
                      {PLACE_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </Select>
                  : <span className="text-xs text-slate-600 dark:text-slate-300">{levelLabel(place.adminLevel)}</span>}
                <OriginBadge origin={item.origin} id={id} source={item.source} quote={item.quote} />
                {item.status === "PROPOSED" ? <button type="button" className="btn-secondary" disabled={pending} onClick={() => decide(item.path, "ACCEPT")}>{c.accept}</button> : null}
                <button type="button" className="btn-secondary" disabled={pending} onClick={() => decide(item.path, "REJECT")} aria-label={`${c.remove} ${place.name ?? ""}`}>{c.remove}</button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <fieldset className="grid gap-3 rounded-xl border border-dashed border-slate-300 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end dark:border-white/20">
        <legend className="px-1 text-sm font-semibold">{c.otherAdd}</legend>
        <Field label={c.otherName}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={c.otherInside}>
          <Select value={inside} onChange={(e) => setInside(e.target.value)}>
            <option value="">{c.none}</option>
            {[...new Set(parents.map((p) => p.name as string))].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </Field>
        <button type="button" className="btn" disabled={pending || !name.trim()} onClick={add}>{c.otherAdd}</button>
      </fieldset>
    </section>
  );
}
