"use client";

import { useMemo, useRef } from "react";
import { dataVisualOption, type BlockModel, type DataVisualModel, type PaintFrame } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { useDatasetFilters } from "@/features/canvas/filters/dataset-filters";
import { NothingToShow, screenText } from "@/features/canvas/presentation/screens/screen-text";
import { chartTheme } from "../domain/chart-theme";
import { DataChart } from "./DataChart";
import { DataTableView } from "./DataTableView";
import { DataCardView } from "./DataCardView";
import { DatasetMapView } from "./DatasetMapView";

const CHART_FAMILIES = new Set(["BAR", "STACKED_BAR", "LINE", "AREA", "PIE"]);

/**
 * A dataset visual on screen (Phase 54). Draws the model the server resolved: a chart through the shared option builder, a table, a card,
 * or a ranked list of places for a map family. A click on a category filters the canvas by it (and again clears it).
 */
export function DataVisualScreen({ model, frame }: { model: BlockModel<DataVisualModel>; frame: PaintFrame }) {
  const { t } = useI18n();
  const filters = useDatasetFilters();
  const box = useRef<HTMLDivElement>(null);
  const m = model.state === "ready" ? model.model : undefined;
  const source = m?.source ?? "";
  const column = m?.crossFilterColumn;
  const selected = filters && column ? filters.values(source, column) : [];
  const option = useMemo(() => (m && CHART_FAMILIES.has(m.family) ? dataVisualOption(m, chartTheme(box.current), selected) : null), [m, selected]);
  if (model.state !== "ready" || !m) return <NothingToShow text={screenText(frame)} reason={model.state === "ready" ? "" : model.reason} authoring={model.state === "empty" && model.authoring} />;
  const pick = filters && column ? (name: string) => filters.toggle(source, column, name, true) : undefined;
  return (
    <div ref={box} className="flex h-full flex-col gap-1 px-3 py-2">
      <div className="min-h-0 flex-1">
        {option ? <DataChart option={option} label={m.title ?? t("ds.visual.label")} onPick={pick} />
          : m.family === "CARD" ? <DataCardView table={m.table} />
          : m.map ? <div className="h-full overflow-auto"><DatasetMapView map={m.map} projectId={m.projectId} /></div>
          : <DataTableView table={m.table} ranked={m.family === "MAP"} onPick={pick} selected={selected} />}
      </div>
      {model.notes.length > 0 && <ul className="space-y-0.5 text-[11px] text-slate-500">{model.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
      {selected.length > 0 && filters && column && <button type="button" className="self-start text-xs underline" onClick={() => filters.clear(source, column)}>{t("ds.visual.clearPick", { values: selected.join(", ") })}</button>}
    </div>
  );
}
