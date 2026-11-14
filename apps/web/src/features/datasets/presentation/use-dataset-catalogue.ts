"use client";

import { useEffect, useState } from "react";
import { getVisualCatalogueAction } from "@/lib/actions/visual-data";
import type { CatalogueView } from "@/lib/server/schemas-visual-data";

export type DatasetSourceView = CatalogueView["sources"][number];

let cache: { at: number; value: Promise<DatasetSourceView[]> } | null = null;

/** The datasets the person can see, as catalogue sources (read once a minute at most, shared by every field on the page). */
export function useDatasetCatalogue(): { sources: DatasetSourceView[]; loading: boolean } {
  const [sources, setSources] = useState<DatasetSourceView[] | null>(null);
  useEffect(() => {
    if (!cache || Date.now() - cache.at > 60_000) cache = { at: Date.now(), value: getVisualCatalogueAction().then((r) => (r.ok ? r.value.sources.filter((s) => s.dataset) : [])) };
    let live = true;
    void cache.value.then((v) => { if (live) setSources(v); });
    return () => { live = false; };
  }, []);
  return { sources: sources ?? [], loading: sources === null };
}
