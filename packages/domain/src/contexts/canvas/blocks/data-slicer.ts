import { defineBlock } from "../block-definition.js";
import { NOT_READ, type DatasetBlockData } from "./dataset-data.js";

/**
 * A slicer on a dataset column (Phase 54, §3.7): lists the column's values with their row counts; the viewer's choice narrows every
 * dataset visual of the canvas that reads the same dataset, through the dataset filters, never by changing the canvas. A period column
 * lists its periods newest first. Columns a share link may not show are never offered there (the server strips them first).
 */
export interface DataSlicerProps { source: string; column: string; label?: string | undefined; multi?: boolean | undefined }
export interface DataSlicerModel { source: string; column: string; label: string; options: Array<{ value: string; rows: number }>; multi: boolean }

export const MAX_SLICER_OPTIONS = 200;

export const dataSlicerBlock = defineBlock<DataSlicerProps, DataSlicerModel, DatasetBlockData | undefined>({
  kind: "DATA_SLICER",
  family: "CONTROLS",
  labelKey: "canvas.block.DATA_SLICER",
  requiresSetup: true,
  reads: "DATASET",
  slicer: true,
  defaults: () => ({ source: "", column: "", multi: true }),
  validate: (p) => (!p.source ? [{ message: "Choose the dataset this slicer filters." }] : !p.column ? [{ message: "Choose the column to filter by." }] : (p.label?.length ?? 0) > 40 ? [{ message: "A slicer label is at most 40 characters." }] : []),
  slots: [],
  sizes: { min: { w: 2, h: 2 }, max: { w: 12, h: 6 }, default: { w: 4, h: 2 } },
  lint: [],
  resolve: (p, data) => {
    if (!data) return NOT_READ;
    const field = data.source.fields.find((f) => f.id === p.column);
    if (!field) return { state: "unavailable", reason: "This column is not in the dataset (or is not shown through a link)." };
    if (field.role !== "DIMENSION") return { state: "unavailable", reason: `${field.label} is a figure; a slicer filters by something to group by.` };
    const counts = new Map<string, number>();
    for (const r of data.rows) { const v = r.values[p.column]; if (v !== null && v !== undefined && v !== "") counts.set(String(v), (counts.get(String(v)) ?? 0) + 1); }
    const dated = field.type === "DATE";
    const options = [...counts].map(([value, rows]) => ({ value, rows })).sort((a, b) => (dated ? b.value.localeCompare(a.value) : a.value.localeCompare(b.value)));
    if (options.length === 0) return { state: "empty", reason: `No ${field.label.toLowerCase()} is recorded.` };
    const notes = options.length > MAX_SLICER_OPTIONS ? [`Showing the first ${MAX_SLICER_OPTIONS} of ${options.length}; type to find the others.`] : [];
    return { state: "ready", model: { source: p.source, column: p.column, label: p.label?.trim() || field.label, options: options.slice(0, MAX_SLICER_OPTIONS), multi: p.multi !== false }, notes };
  },
});
