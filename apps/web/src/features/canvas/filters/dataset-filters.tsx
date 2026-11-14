"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * The viewer's slicer choices on dataset columns (Phase 54), shared by the slicers and the dataset visuals of one canvas. A choice
 * narrows what the page shows, never the canvas itself; the page that owns the choice reads the canvas again with it.
 */
export interface DatasetFilterApi {
  values(source: string, column: string): string[];
  toggle(source: string, column: string, value: string, multi: boolean): void;
  clear(source: string, column: string): void;
}

const Ctx = createContext<DatasetFilterApi | null>(null);
export const DatasetFilterProvider = ({ api, children }: { api: DatasetFilterApi; children: ReactNode }) => <Ctx.Provider value={api}>{children}</Ctx.Provider>;
/** null outside a canvas page that offers dataset filters (a file preview, a thumbnail): the slicer then shows its options only. */
export const useDatasetFilters = (): DatasetFilterApi | null => useContext(Ctx);
