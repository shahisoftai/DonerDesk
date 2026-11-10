"use client";

import { useEffect, useState } from "react";
import { placesAffectedByDiff, type BoundaryDiff } from "@donordesk/domain/contexts/places/boundary-diff.js";
import type { PlaceItem } from "@/lib/server/schemas-places";
import { loadBoundaryManifest } from "@/lib/client/boundary-loader";
import { useMapText } from "@/features/maps/presentation/useMapText";

interface Hit { id: string; name: string; code: string; reason: "RETIRED" | "MOVED" }

/**
 * Places whose code an official boundary update retired or moved (Phase 49.3). Read only: it names them and says why; a person decides
 * whether to change the code. Nothing shows when no update touched the organisation's places.
 */
export function BoundaryChangesCard({ places }: { places: readonly PlaceItem[] }) {
  const { t } = useMapText();
  const [hits, setHits] = useState<Hit[]>([]);
  useEffect(() => {
    let live = true;
    void (async () => {
      const manifest = await loadBoundaryManifest();
      const files = manifest?.countries.flatMap((c) => c.files).map((f) => f.changes).filter((x): x is string => !!x) ?? [];
      const coded = places.filter((p) => !p.archived && p.code);
      if (files.length === 0 || coded.length === 0) return;
      const diffs = await Promise.all(files.map((f) => fetch(`/geo/${f}?v=${encodeURIComponent(manifest!.generatedAt)}`).then((r) => (r.ok ? (r.json() as Promise<BoundaryDiff>) : null)).catch(() => null)));
      const found = new Map<string, Hit>();
      for (const diff of diffs) if (diff) for (const h of placesAffectedByDiff(coded, diff)) found.set(h.place.id, { id: h.place.id, name: h.place.name, code: h.place.code ?? "", reason: h.reason });
      if (live) setHits([...found.values()]);
    })();
    return () => { live = false; };
  }, [places]);
  if (hits.length === 0) return null;
  return (
    <section className="card" aria-labelledby="boundary-changes-title">
      <h2 id="boundary-changes-title" className="text-sm font-semibold">{t("maps.boundaryChanges.title")}</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t("maps.boundaryChanges.intro")}</p>
      <ul className="mt-2 space-y-1 text-sm">
        {hits.map((h) => <li key={h.id}><strong>{h.name}</strong> ({h.code}): {t(h.reason === "RETIRED" ? "maps.boundaryChanges.retired" : "maps.boundaryChanges.moved")}</li>)}
      </ul>
    </section>
  );
}
