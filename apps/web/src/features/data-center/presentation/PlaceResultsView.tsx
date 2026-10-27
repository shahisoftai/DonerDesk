"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getPlaceResultsAction } from "@/lib/actions/places";
import type { PlaceResults } from "@/lib/server/schemas-places";
import { PLACE_RESULTS_COPY as C } from "@/features/places/domain/place-results-copy";
import { PLACE_LEVEL_LABEL } from "@/features/places/domain/places-copy";

const num = (v: string | null) => Number((v ?? "").replace(/,/g, ""));

/** The Data Center's "By place" view: results read at a chosen level of the place tree. Reads only. */
export function PlaceResultsView({ projectId }: { projectId: string }) {
  const [level, setLevel] = useState(1);
  const [data, setData] = useState<PlaceResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (next: number) => {
    setError(null);
    const out = await getPlaceResultsAction(projectId, next);
    if (!out.ok) { setError(out.error.message); return; }
    setData(out.value);
    // Offer a level the list really has: the first request asks for states, an organisation may only have localities.
    if (out.value.levelsAvailable.length > 0 && !out.value.levelsAvailable.includes(next)) {
      const fallback = out.value.levelsAvailable.find((l) => l >= next) ?? out.value.levelsAvailable[out.value.levelsAvailable.length - 1]!;
      if (fallback !== next) { setLevel(fallback); }
    }
  }, [projectId]);

  useEffect(() => { void load(level); }, [level, load]);

  function csv(): string {
    const lines = [["Indicator", "Place", "Recorded", "Note"]];
    for (const ind of data?.indicators ?? []) {
      for (const r of ind.rollup.rows) {
        const notes = [r.partly ? C.partly(r.contributors, r.listedBelow) : "", r.unverified > 0 ? C.unverified(r.unverified) : "", r.value === null ? C.notCombined : ""].filter(Boolean).join(" ");
        lines.push([`${ind.code} ${ind.name}`, r.path, r.value ?? "", notes]);
      }
    }
    return lines.map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  }

  if (error) return <p role="alert" className="text-sm text-danger-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">{C.loading}</p>;
  if (data.noPlaces) {
    return (
      <div className="card text-sm">
        <p>{C.noPlaces}</p>
        <Link className="mt-2 inline-block font-medium underline" href="/settings/places">{C.noPlacesAction}</Link>
      </div>
    );
  }

  const anyUnplaced = data.indicators.some((i) => i.rollup.unplaced.length > 0);
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600 dark:text-slate-300">{C.intro}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{C.levelLabel}</span>
        <div role="group" aria-label={C.levelLabel} className="flex flex-wrap gap-1">
          {data.levelsAvailable.map((l) => (
            <button key={l} type="button" aria-pressed={l === level} onClick={() => setLevel(l)} className={`rounded-full border px-3 py-1 text-sm ${l === level ? "border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200" : "border-slate-300 text-slate-700 dark:border-white/15 dark:text-slate-200"}`}>
              {PLACE_LEVEL_LABEL[l] ?? l}
            </button>
          ))}
        </div>
        {data.indicators.length > 0 && (
          <a className="ml-auto text-sm font-medium underline" href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv())}`} download="results-by-place.csv">{C.download}</a>
        )}
      </div>

      {data.indicators.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-300">{C.nothing}</p>}

      {data.indicators.map((ind) => {
        const max = Math.max(1, ...ind.rollup.rows.map((r) => num(r.value) || 0));
        return (
          <section key={ind.id} className="card" aria-labelledby={`pr-${ind.id}`}>
            <h3 id={`pr-${ind.id}`} className="text-sm font-semibold"><span className="font-mono text-xs text-slate-500">{ind.code}</span> {ind.name}{ind.unit ? <span className="ml-1 text-xs font-normal text-slate-500">({ind.unit})</span> : null}</h3>
            {!ind.rollup.additive && <p className="mt-1 text-xs text-slate-500">{C.rateNote}</p>}
            {ind.rollup.rows.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{C.nothing}</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500"><th className="py-1 pr-3 font-medium">{C.columns.place}</th><th className="py-1 pr-3 font-medium">{C.columns.value}</th><th className="py-1 font-medium">{C.columns.note}</th></tr></thead>
                <tbody>
                  {ind.rollup.rows.map((r) => (
                    <tr key={r.placeId} className="border-t border-slate-100 align-top dark:border-white/5">
                      <td className="py-1.5 pr-3"><span className="font-medium">{r.name}</span><span className="block text-xs text-slate-500">{r.path}</span></td>
                      <td className="py-1.5 pr-3 tabular-nums">
                        {r.value === null ? <span className="text-slate-500">{C.notCombined}</span> : (
                          <div className="flex items-center gap-2">
                            <span className="min-w-[3.5rem]">{r.value}</span>
                            {ind.rollup.additive && <span aria-hidden className="block h-2 rounded bg-brand-500/70" style={{ width: `${Math.max(2, Math.round((num(r.value) / max) * 120))}px` }} />}
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 text-xs text-slate-600 dark:text-slate-300">
                        {r.partly && <p className="text-amber-700 dark:text-amber-300">{C.partly(r.contributors, r.listedBelow)}</p>}
                        {r.unverified > 0 && <p>{C.unverified(r.unverified)}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {ind.rollup.unplaced.length > 0 && (
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs dark:bg-white/5">
                <p className="font-medium">{C.unplacedTitle}</p>
                <ul className="mt-1 list-disc pl-5">
                  {ind.rollup.unplaced.map((u) => <li key={`${u.location}-${u.reason}`}>{u.location} ({u.value}): {C.unplacedReason[u.reason]}{u.candidates ? ` — ${u.candidates.join("; ")}` : ""}</li>)}
                </ul>
              </div>
            )}
          </section>
        );
      })}

      {anyUnplaced && <Link className="text-sm font-medium underline" href="/settings/places">{C.fixPlaces}</Link>}

      {data.withoutLocation.length > 0 && (
        <section className="card" aria-labelledby="pr-without">
          <h3 id="pr-without" className="text-sm font-semibold">{C.withoutTitle}</h3>
          <p className="mt-1 text-xs text-slate-500">{C.withoutNote}</p>
          <ul className="mt-2 list-disc pl-5 text-sm">{data.withoutLocation.map((i) => <li key={i.id}><span className="font-mono text-xs text-slate-500">{i.code}</span> {i.name}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
