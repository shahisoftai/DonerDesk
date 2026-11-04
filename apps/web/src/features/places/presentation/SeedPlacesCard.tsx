"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { seedPlacesFromBoundariesAction } from "@/lib/actions/places";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { loadAdmin1File, loadBoundaryFile, loadBoundaryManifest } from "@/lib/client/boundary-loader";
import { attributionLine, fileFor, levelsFor, type BoundaryCountry, type BoundaryLevel, type BoundaryManifest } from "@/features/maps/domain/boundary-sources";
import { admin1FileKey, unitFromFeature, type BoundaryUnit } from "@/features/maps/domain/boundaries/join";
import { seedUnitsFrom, type SeedLevel } from "../domain/boundary-seed";
import type { SeedPlacesPreview } from "@/lib/server/schemas-places";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

const LEVEL_WORD: Record<SeedLevel, string> = { 1: "Provinces or states", 2: "Districts", 3: "Sub-districts", 4: "Wards, parishes or communes" };

/** Reads one level of a country as units: provinces from the small per-country file, finer levels from the manifest's file. */
async function unitsOf(country: BoundaryCountry, level: BoundaryLevel): Promise<BoundaryUnit[]> {
  const collection = level === 1 ? await loadAdmin1File(admin1FileKey(country.name)) : await (async () => { const entry = fileFor(country, level); return entry ? loadBoundaryFile(entry) : null; })();
  return (collection?.features ?? []).map((f) => unitFromFeature(f as Parameters<typeof unitFromFeature>[0])).filter((u): u is BoundaryUnit => u !== null);
}

/**
 * Adds a country's places (provinces, districts, wards) from the built-in boundaries in one step. It first counts what would be created and
 * what is already in the list; nothing is saved until the person confirms. Places already listed (same code, or same name inside the same parent) are left alone.
 */
export function SeedPlacesCard() {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [manifest, setManifest] = useState<BoundaryManifest | null | undefined>(undefined);
  const [iso, setIso] = useState("");
  const [levels, setLevels] = useState<SeedLevel[]>([]);
  const [preview, setPreview] = useState<SeedPlacesPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [dropped, setDropped] = useState<SeedLevel[]>([]);

  useEffect(() => { void loadBoundaryManifest().then(setManifest); }, []);
  const country = manifest?.countries.find((c) => c.iso === iso) ?? null;
  const available = country ? ([1, ...levelsFor(country).filter((l) => l > 1)] as SeedLevel[]).filter((l, i, a) => a.indexOf(l) === i) : [];

  async function run(apply: boolean) {
    if (!country || levels.length === 0) return;
    setBusy(true);
    try {
      const byLevel: Partial<Record<SeedLevel, BoundaryUnit[]>> = {};
      for (const level of levels) byLevel[level] = await unitsOf(country, level);
      const { units, dropped: left } = seedUnitsFrom(byLevel);
      setDropped(left);
      const done = await state.run(() => seedPlacesFromBoundariesAction({ country: { name: country.name }, units, apply }));
      if (!done) return;
      setPreview(done);
      if (done.applied) router.refresh();
    } finally { setBusy(false); }
  }

  if (manifest === null) return null;
  const total = preview ? Object.values(preview.createdByLevel).reduce((a, b) => a + b, 0) : 0;
  return (
    <section className="card mt-6 space-y-3" aria-labelledby="seed-title">
      <h2 id="seed-title" className="text-base font-semibold">Add a country&apos;s places</h2>
      <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">Fills your list from the built-in boundaries, so names and codes are spelled the way the maps expect. You see what would be added before anything is saved, and places you already have are left alone.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Country
          <Select value={iso} onChange={(e) => { setIso(e.target.value); setLevels([]); setPreview(null); }} disabled={!manifest}>
            <option value="">{manifest ? "Choose a country" : "Loading…"}</option>
            {manifest?.countries.map((c) => <option key={c.iso} value={c.iso}>{c.name}</option>)}
          </Select>
        </label>
        {available.map((l) => (
          <label key={l} className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={levels.includes(l)} onChange={(e) => { setPreview(null); setLevels((cur) => (e.target.checked ? [...cur, l].sort() : cur.filter((x) => x !== l))); }} />
            {LEVEL_WORD[l]}
          </label>
        ))}
      </div>
      {country && <p className="text-xs text-slate-500">{attributionLine(country, [...levels].reverse().find((l) => l > 1) as BoundaryLevel | undefined)}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={!hydrated || busy || !country || levels.length === 0} onClick={() => run(false)}>{busy ? "Checking…" : "See what would be added"}</Button>
        {preview && !preview.applied && preview.problems.length === 0 && total > 0 && <Button type="button" disabled={!hydrated || busy} onClick={() => run(true)}>Add {total} places</Button>}
      </div>
      {preview && dropped.includes(1) && <p className="text-xs text-slate-500">Provinces were not added: this country&apos;s finer boundaries name provinces we do not hold, so adding ours would not line up. Districts and below were added directly under the country.</p>}
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {preview && (
        <div className="space-y-1 text-sm" role="status">
          {preview.problems.length > 0 ? (
            <ul className="list-disc ps-5 text-red-700">{preview.problems.slice(0, 8).map((p) => <li key={p}>{p}</li>)}</ul>
          ) : (
            <>
              <p>{preview.applied ? "Added" : "Would add"}: {Object.entries(preview.createdByLevel).sort().map(([l, n]) => `${n} ${l === "0" ? "country" : LEVEL_WORD[Number(l) as SeedLevel].toLowerCase()}`).join(", ") || "nothing new"}. Already in your list: {preview.skipped}.</p>
              {preview.underCountry > 0 && <p className="text-xs text-slate-500">{preview.underCountry} places could not be placed inside a larger area with certainty, so they sit directly under the country. You can move them later.</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}
