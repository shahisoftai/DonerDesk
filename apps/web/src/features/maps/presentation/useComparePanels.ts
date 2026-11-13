"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlaceItem, PlaceResults } from "@/lib/server/schemas-places";
import { buildMapScenePanels } from "../domain/scene/compare-panels";
import { panelPeriods } from "../domain/map-explorer";
import type { LayerSpec } from "../domain/model/scene";
import type { PlaceResultsLoader } from "./results-loader";

/** Side-by-side periods (the "compare" choice): one small map per recent period, read when switched on, drawn on one shared scale. */
export function useComparePanels(input: {
  periods: ReadonlyArray<{ id: string; label: string }>;
  ready: boolean;
  level: number;
  projectId: string;
  read: PlaceResultsLoader;
  places: readonly PlaceItem[];
  indicatorId: string;
  indicatorUnit: string | null;
  layers: Parameters<typeof buildMapScenePanels>[0]["layers"];
  units: Parameters<typeof buildMapScenePanels>[0]["units"];
  lang: string;
  summaryOf: Parameters<typeof buildMapScenePanels>[0]["summaryOf"];
}) {
  const [compare, setCompare] = useState(false);
  const [panels, setPanels] = useState<Array<{ label: string; results: PlaceResults }>>([]);
  const latest = useMemo(() => panelPeriods(input.periods), [input.periods]);
  const { ready, level, projectId, read } = input;
  useEffect(() => {
    if (!compare || !ready) return;
    let live = true;
    void Promise.all(latest.map((p) => read(projectId, level, p.id).then((o) => (o.ok ? { label: p.label, results: o.value } : null)))).then((all) => { if (live) setPanels(all.filter((x): x is { label: string; results: PlaceResults } => x !== null)); });
    return () => { live = false; };
    // `read` is stable per render of the explorer; the panels are asked again when what they depend on changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compare, ready, level, projectId, latest]);
  const scenes = useMemo(() => buildMapScenePanels({ panels, places: input.places, indicatorId: input.indicatorId, indicatorUnit: input.indicatorUnit, layers: input.layers, units: input.units, lang: input.lang, summaryOf: input.summaryOf }), [panels, input.places, input.indicatorId, input.indicatorUnit, input.layers, input.units, input.lang, input.summaryOf]);
  return { compare, setCompare, scenes };
}
export type { LayerSpec };
