"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NO_FILTER, toggleDatasetFilter, datasetFilterValues, canvasThemeOf, canvasToWidgets, definitionFor, type BlockModel, type Canvas, type CrossFilter } from "@donordesk/domain/contexts/canvas/index.js";
import type { ChartDrawing } from "@/lib/server/schemas-dashboards";
import { PublicChoicesSchema } from "@/lib/server/schemas-canvas";
import { z } from "zod";
import { CanvasPageGrid } from "./CanvasPageGrid";
import { FilterPane, type FilterBarProps } from "../filters/FilterPane";
import { FilterSlotProvider } from "../filters/filter-slot";
import { useFilterAddress } from "../filters/use-filter-address";
import { DatasetFilterProvider, type DatasetFilterApi } from "../filters/dataset-filters";
import { DatasetMapProvider } from "@/features/datasets/presentation/dataset-map-slot";
import { DatasetMapView } from "@/features/datasets/presentation/DatasetMapView";
import { MapServicesProvider, publicMapServices } from "@/features/maps/presentation/MapServices";

const NO_SELECTION: ReadonlySet<string> = new Set();
type Choices = z.infer<typeof PublicChoicesSchema>;
interface Props { canvas: Canvas; drawings: ChartDrawing[]; models: Record<string, BlockModel<unknown>>; repeats?: Record<string, Array<{ key: string; label: string }>>; choices?: Choices; token?: string }

/**
 * The read-only canvas a link holder sees: the same blocks as the editor, never editable, drawn from what the server read as a guest. The page's
 * filter bar works here too, for a period and places only; each choice asks the server for the page again (the link is the credential), so
 * a figure is never worked out in the browser. Donors, partners and money are not offered through a link.
 */
export function PublicCanvasView({ canvas, drawings: first, models: firstModels, repeats, choices: firstChoices, token }: Props) {
  const [drawings, setDrawings] = useState(first);
  const [models, setModels] = useState(firstModels);
  const [choices, setChoices] = useState<Choices>(firstChoices ?? { periods: [], places: [] });
  const [filters, setFilters] = useState<CrossFilter>(NO_FILTER);
  const [failed, setFailed] = useState(false);
  const widgets = useMemo(() => new Map(canvasToWidgets(canvas, undefined).widgets.map((w) => [w.id, w])), [canvas]);
  const byId = useMemo(() => new Map(drawings.map((d) => [d.widgetId, d])), [drawings]);
  const bar = useMemo(() => (canvas.pages.flatMap((p) => p.blocks).find((b) => definitionFor(b.kind)?.family === "CONTROLS" && b.style?.hidden !== true)?.props ?? null) as FilterBarProps | null, [canvas]);
  const theme = useMemo(() => canvasThemeOf(canvas), [canvas]);
  useFilterAddress(filters, setFilters);

  // Ask the server for the page again whenever a choice changes (and once when the page opens with a choice in its address).
  const latest = useRef(0);
  const reload = useCallback(async (f: CrossFilter) => {
    if (!token) return;
    const n = ++latest.current;
    const query = new URLSearchParams({ ...(f.periodId ? { periodId: f.periodId } : {}), ...(f.places.length ? { places: f.places.join(",") } : {}), ...(f.datasets?.some((d) => d.values.length) ? { ds: JSON.stringify(f.datasets.filter((d) => d.values.length)) } : {}) });
    try {
      const r = await fetch(`/api/shared/canvas/${encodeURIComponent(token)}/data?${query}`, { headers: { accept: "application/json" }, cache: "no-store" });
      if (n !== latest.current) return;
      if (!r.ok) { setFailed(true); return; }
      const body = (await r.json()) as { drawings: ChartDrawing[]; models: Record<string, BlockModel<unknown>>; choices: Choices };
      setDrawings(body.drawings); setModels(body.models); setChoices((c) => ({ ...c, ...body.choices })); setFailed(false);
    } catch { if (n === latest.current) setFailed(true); }
  }, [token]);
  const first_ = useRef(true);
  useEffect(() => {
    if (first_.current) { first_.current = false; if (!filters.periodId && filters.places.length === 0 && !filters.datasets?.length) return; }
    void reload(filters);
  }, [filters, reload]);

  // Slicers on a link narrow by the dataset columns a guest may see; the server checks them again.
  const datasetApi = useMemo<DatasetFilterApi>(() => ({
    values: (source, column) => datasetFilterValues(filters, source, column),
    toggle: (source, column, value, multi) => setFilters((f) => toggleDatasetFilter(f, source, column, value, multi)),
    clear: (source, column) => setFilters((f) => ({ ...f, datasets: (f.datasets ?? []).filter((d) => !(d.source === source && d.column === column)) })),
  }), [filters]);
  const slot = bar ? <FilterPane bar={bar} choices={{ ...choices, groups: [], statuses: [], levels: [], indicators: [] }} filters={filters} tone={{ strip: theme.accentSoft, ink: theme.accent, on: theme.accent }} onChange={setFilters} onClear={() => setFilters(NO_FILTER)} /> : null;
  return (
    <MapServicesProvider value={publicMapServices()}>
    <DatasetFilterProvider api={datasetApi}><DatasetMapProvider value={DatasetMapView}>
    <div className="space-y-6" dir={canvas.language === "ar" ? "rtl" : "ltr"}>
      {failed && <p role="status" className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">The page could not be refreshed for that choice just now. What you see is the last page that loaded.</p>}
      <FilterSlotProvider value={slot}>
        {canvas.pages.map((page) => (
          <section key={page.id} aria-label={page.title}>
            {canvas.pages.length > 1 && <h2 className="mb-2 text-lg font-semibold">{page.title}</h2>}
            <CanvasPageGrid canvas={canvas} blocks={page.blocks.filter((b) => b.style?.hidden !== true)} drawings={byId} widgets={widgets} models={models} repeats={repeats} editing={false} selectedIds={NO_SELECTION} onSelect={() => undefined} isChanged={() => false} />
          </section>
        ))}
      </FilterSlotProvider>
    </div>
    </DatasetMapProvider></DatasetFilterProvider>
    </MapServicesProvider>
  );
}
