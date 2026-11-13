/**
 * One scene per period for the side-by-side view: every panel is coloured on one shared scale (`sharedBands`) so the same colour means the
 * same number in each. Pure; the explorer's hook reads the periods and hands the results here.
 */
import { joinUnits, type BoundaryUnit } from "../boundaries/join.ts";
import { buildExplorerModel, sharedBands, summaryCounts, withBands, type ExplorerLayer, type ExplorerModel } from "../map-explorer.ts";
import { buildResultsScene } from "./build-scene.ts";
import type { MapScene } from "../model/scene.ts";

export interface ComparePanelsInput {
  panels: ReadonlyArray<{ label: string; results: Parameters<typeof buildExplorerModel>[0] }>;
  places: Parameters<typeof buildExplorerModel>[1];
  indicatorId: string;
  indicatorUnit: string | null;
  layers: readonly ExplorerLayer[];
  units: readonly BoundaryUnit[];
  lang: string;
  /** The map's one-line summary for a model ("12 of 40 places have a figure"). */
  summaryOf: (counts: ReturnType<typeof summaryCounts>) => string;
}

export function buildMapScenePanels(i: ComparePanelsInput): Array<{ label: string; scene: MapScene }> {
  const models = i.panels.map((p) => ({ label: p.label, model: buildExplorerModel(p.results, i.places, i.indicatorId) })).filter((x): x is { label: string; model: ExplorerModel } => x.model !== null);
  const bands = sharedBands(models.map((m) => m.model));
  return models.map((m) => ({
    label: m.label,
    scene: buildResultsScene({
      model: withBands(m.model, bands), layers: i.layers,
      joined: joinUnits(i.units as BoundaryUnit[], (i.places as ReadonlyArray<{ id: string }>).filter((p) => m.model.regions.some((r) => r.placeId === p.id)) as never, i.places as never),
      unit: i.indicatorUnit, selectedRef: null, selectedPlaceId: null, basemap: "plain", lang: i.lang, label: `${m.label}: ${i.summaryOf(summaryCounts(m.model))}`,
    }),
  }));
}
