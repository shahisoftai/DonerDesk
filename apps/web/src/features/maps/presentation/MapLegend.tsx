"use client";

import type { AreaStyle } from "../domain/scene/area-style";
import { useMapText } from "./useMapText";

interface Props { bands: ReadonlyArray<{ from: number; to: number; color: string }>; areaStyle?: AreaStyle | undefined; areas: ReadonlyArray<{ name: string; color: string }> }

/**
 * What the colours of a results map mean (Phase 50.3d): the figure's bands, the author's bands, or one entry per area when areas are
 * coloured by category. A legend never shows a scale the map is not using. "Not measured" is always grey.
 */
export function MapLegend({ bands, areaStyle, areas }: Props) {
  const { t } = useMapText();
  const swatch = (color: string) => <span className="inline-block h-3 w-5" style={{ background: color }} />;
  const mode = areaStyle?.colorBy ?? "VALUE";
  if (mode === "NONE") return null;
  let entries: Array<{ key: string; color: string; label: string }>;
  if (mode === "CATEGORY") {
    const seen = new Map<string, string>();
    for (const a of areas) if (!seen.has(a.color)) seen.set(a.color, a.name);
    entries = [...seen.entries()].map(([color, name]) => ({ key: color, color, label: name }));
  } else if (mode === "RULES") {
    entries = (areaStyle?.bands ?? []).map((b, i) => ({ key: String(i), color: b.color, label: b.from === null ? `< ${b.to}` : b.to === null ? `≥ ${b.from}` : `${b.from}–${b.to}` }));
  } else {
    entries = bands.map((b, i) => ({ key: String(i), color: b.color, label: Math.round(b.from) === Math.round(b.to) ? Math.round(b.from).toLocaleString() : `${Math.round(b.from).toLocaleString()}–${Math.round(b.to).toLocaleString()}` }));
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" aria-label={t("maps.legend")} data-testid="map-legend">
      {entries.map((e) => <span key={e.key} className="inline-flex items-center gap-1">{swatch(e.color)}<bdi>{e.label}</bdi></span>)}
      {mode !== "CATEGORY" && <span className="inline-flex items-center gap-1">{swatch("#e5e7eb")}{t("maps.notMeasured")}</span>}
    </div>
  );
}
