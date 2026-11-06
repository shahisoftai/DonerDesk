/**
 * The ECharts option for the interactive map: a pure function of the model, the layers and the view.
 * The component that owns the chart never decides a colour, a size or a tooltip; it passes this option
 * to the chart and forwards clicks to `map-explorer.ts`.
 */
import { normalizeLocationKey } from "@donordesk/domain/contexts/workplan/index.js";
import { overlaySeries, type Overlay } from "./overlay-layer.ts";
import { NO_DATA_COLOR, layerState, regionColors, type DrillState, type ExplorerLayer, type ExplorerModel } from "./map-explorer.ts";

export const WORLD_MAP_NAME = "donordesk-world";
export const DRILL_MAP_NAME = "donordesk-drill";

const escapeHtml = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function tooltipFor(name: string, path: string | null, display: string | null, unit: string | null, verified: boolean): string {
  const lines = [`<strong>${escapeHtml(name)}</strong>`];
  if (path && path !== name) lines.push(`<span style="color:#64748b">${escapeHtml(path)}</span>`);
  if (display === null) lines.push("Not measured");
  else lines.push(`${escapeHtml(display)}${unit ? ` ${escapeHtml(unit)}` : ""}${verified ? "" : " <em>(not verified yet)</em>"}`);
  return lines.join("<br/>");
}

export interface ExplorerOptionInput {
  model: ExplorerModel;
  layers: readonly ExplorerLayer[];
  view: DrillState;
  /** The names of the boundaries on the map being drawn (so every one gets a colour, or grey). */
  featureNames: readonly string[];
  unit: string | null;
  selectedPlaceId: string | null;
  overlay?: Overlay | null;
}

export function explorerOption(input: ExplorerOptionInput): Record<string, unknown> {
  const { model, layers, view, featureNames, unit, selectedPlaceId, overlay } = input;
  const fill = layerState(layers, "FILL");
  const symbols = layerState(layers, "SYMBOLS");
  const bounds = layerState(layers, "BOUNDARIES");
  const colors = regionColors(model);

  const regions = featureNames.map((name) => {
    const hit = colors.get(normalizeLocationKey(name));
    const selected = hit !== undefined && hit.region.placeId === selectedPlaceId;
    return {
      name,
      itemStyle: {
        areaColor: fill.visible ? (hit?.color ?? NO_DATA_COLOR) : "#f1f5f9",
        opacity: fill.visible ? fill.opacity : 1,
        borderColor: selected ? "#0f172a" : bounds.visible ? "#64748b" : "rgba(0,0,0,0)",
        borderWidth: selected ? 2 : bounds.visible ? 0.8 : 0,
      },
      emphasis: { itemStyle: { areaColor: hit?.color ?? "#cbd5e1", borderColor: "#0f172a", borderWidth: 1.5 } },
      regionInfo: hit?.region ?? null,
    };
  });

  const max = Math.max(1, ...model.pins.map((p) => p.value ?? 0));
  const series: Array<Record<string, unknown>> = [];
  if (symbols.visible) {
    series.push({
      type: "scatter",
      coordinateSystem: "geo",
      itemStyle: { opacity: symbols.opacity, borderColor: "#fff", borderWidth: 1 },
      emphasis: { scale: 1.2 },
      data: model.pins.map((p) => ({
        name: p.name,
        value: [p.lng, p.lat],
        placeId: p.placeId,
        symbolSize: p.value === null ? 8 : 10 + Math.sqrt(p.value / max) * 26,
        itemStyle: { color: p.value === null ? NO_DATA_COLOR : "#b45309", borderColor: p.placeId === selectedPlaceId ? "#0f172a" : "#fff", borderWidth: p.placeId === selectedPlaceId ? 3 : 1 },
        pin: p,
      })),
    });
  }

  const over = layerState(layers, "OVERLAY");
  if (overlay && over.visible) series.push(...overlaySeries(overlay, over.opacity));

  return {
    animation: false,
    tooltip: {
      trigger: "item",
      confine: true,
      formatter: (params: unknown) => {
        const p = params as { componentType?: string; name?: string; data?: { pin?: { name: string; path: string; display: string | null; verified: boolean } } };
        if (p.data?.pin) return tooltipFor(p.data.pin.name, p.data.pin.path, p.data.pin.display, unit, p.data.pin.verified);
        const region = regions.find((r) => r.name === p.name)?.regionInfo;
        return region ? tooltipFor(region.name, region.path, region.display, unit, region.verified) : tooltipFor(p.name ?? "", null, null, unit, true);
      },
    },
    geo: {
      map: view.kind === "WORLD" ? WORLD_MAP_NAME : DRILL_MAP_NAME,
      roam: true,
      scaleLimit: { min: 0.8, max: 40 },
      layoutCenter: ["50%", "50%"],
      layoutSize: "100%",
      itemStyle: { areaColor: NO_DATA_COLOR, borderColor: "#94a3b8", borderWidth: 0.5 },
      select: { disabled: true },
      regions,
    },
    series,
  };
}
