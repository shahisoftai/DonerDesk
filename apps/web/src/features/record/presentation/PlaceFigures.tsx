"use client";

import { useMemo, useState } from "react";
import { matchPlaceChoice, placeEntries, placeRows, startingRows, totalFromPlaces, type PlaceRow, type RecordablePlace } from "@donordesk/domain/contexts/places/place-recording.js";
import type { DisaggregationEntryInput } from "@donordesk/contracts";
import { Input } from "@/components/ui/Input";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

/**
 * One figure per place (Phase 53.2). The rows are the places the project already uses (its work and figures) plus any the person adds by
 * typing a name; the whole organisation's list is only offered as suggestions, never as rows. An empty box is left out, never stored as 0,
 * and the total is the sum of what was typed (additive types only: `totalFromPlaces`). It only reports entries and a total.
 */
export function PlaceFigures({ places, level, type, usedPlaceIds, figures, onChange, chosenIds }: {
  places: readonly RecordablePlace[];
  level: number;
  /** Phase 56: an indicator measured at chosen places shows exactly those places as rows. */
  chosenIds?: readonly string[] | undefined;
  type: string;
  usedPlaceIds: readonly string[];
  figures: Readonly<Record<string, string>>;
  onChange: (figures: Record<string, string>, entries: DisaggregationEntryInput[], total: string) => void;
}) {
  const { t } = useI18n();
  const all = useMemo(() => {
    if (!chosenIds || chosenIds.length === 0) return placeRows(places, level);
    const byId = new Map(places.filter((p) => !p.archived).map((p) => [p.id, p]));
    return chosenIds.flatMap((cid) => { const p = byId.get(cid); return p ? [{ placeId: p.id, name: p.name, path: p.path ?? p.name }] : []; });
  }, [places, level, chosenIds]);
  const [added, setAdded] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const rows = useMemo<PlaceRow[]>(() => {
    if (chosenIds && chosenIds.length) return all;
    const seen = new Set([...startingRows(all, usedPlaceIds).map((r) => r.placeId), ...added]);
    return all.filter((r) => seen.has(r.placeId));
  }, [all, usedPlaceIds, added, chosenIds]);
  const candidates = useMemo(() => all.filter((r) => !rows.some((x) => x.placeId === r.placeId)), [all, rows]);
  const total = totalFromPlaces(type as never, rows.map((r) => ({ value: figures[r.placeId] ?? "" })));

  function report(next: Record<string, string>, shown: readonly PlaceRow[]) {
    // Phase 56: each figure carries its place id, so a rename keeps history and two same-named places stay apart.
    const typedFigures = shown.map((r) => ({ name: r.name, value: next[r.placeId] ?? "", placeId: r.placeId }));
    onChange(next, placeEntries(typedFigures), totalFromPlaces(type as never, typedFigures) ?? "");
  }
  const set = (placeId: string, value: string) => report({ ...figures, [placeId]: value }, rows);
  function choose(text: string) {
    setTyped(text);
    const hit = matchPlaceChoice(text, candidates);
    if (hit) { setAdded((a) => [...a, hit.placeId]); setTyped(""); }
  }

  if (all.length === 0) return <p className="text-sm text-slate-600 dark:text-slate-300">{t("record.value.byPlaceEmpty")}</p>;
  return (
    <fieldset className="space-y-2">
      <legend className="label">{t("record.value.byPlace")}</legend>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.placeId} className="flex items-center gap-3">
            <label className="min-w-0 flex-1 truncate text-base" htmlFor={`place-figure-${r.placeId}`} title={r.path}>{r.name}</label>
            <Input id={`place-figure-${r.placeId}`} className="min-h-[52px] w-32 text-lg font-semibold" inputMode="decimal" autoComplete="off" value={figures[r.placeId] ?? ""} onChange={(e) => set(r.placeId, e.target.value)} />
          </li>
        ))}
      </ul>
      {candidates.length > 0 && (
        <div className="space-y-1">
          <label className="text-sm" htmlFor="place-figure-add">{t("record.value.byPlaceAdd")}</label>
          <Input id="place-figure-add" list="place-figure-options" autoComplete="off" value={typed} placeholder={t("record.value.byPlaceAddHint")} onChange={(e) => choose(e.target.value)} />
          <datalist id="place-figure-options">{candidates.map((c) => <option key={c.placeId} value={c.path} />)}</datalist>
        </div>
      )}
      {total !== null && <p className="text-sm font-semibold" role="status">{t("record.value.byPlaceTotal", { total })}</p>}
    </fieldset>
  );
}
