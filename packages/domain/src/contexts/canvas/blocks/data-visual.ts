import { catalogueWith } from "../../visual-data/catalogue.js";
import type { CalculatedField } from "../../visual-data/calculated.js";
import type { VisualFilter } from "../../visual-data/query.js";
import { validateVisualQuery } from "../../visual-data/query.js";
import { referenceProblems, type ChartReference } from "../../visual-data/references.js";
import { shapeTable, type VisualTable } from "../../visual-data/shape.js";
import { VISUAL_FAMILIES, visualFamilyDef, wellGaps, wellsToQuery, type VisualFamily, type Wells } from "../../visual-data/wells.js";
import { defineBlock } from "../block-definition.js";
import { NOT_READ, rowsNote, type DatasetBlockData } from "./dataset-data.js";

/**
 * A visual drawn from a dataset (Phase 54): fields dragged into wells become one catalogue question, validated by the same rules as
 * any visual (a rate is never summed or averaged, money stays in one currency, a gap is "Not reported"). Families that compare along
 * an axis may carry reference lines (a standard such as "cure rate 75 %"). A click on a bar, slice or area filters the canvas by
 * that value (`crossFilter`), through the dataset filters, never by changing the canvas.
 */
export interface DataVisualProps {
  source: string;
  family: VisualFamily;
  wells: Wells;
  calculated?: CalculatedField[] | undefined;
  references?: ChartReference[] | undefined;
  /** Fixed filters of this visual (a kit page's "Funding = RRP"), applied before the viewer's. */
  filters?: VisualFilter[] | undefined;
  title?: string | undefined;
  altText?: string | undefined;
  sort?: "VALUE_DESC" | "VALUE_ASC" | "LABEL" | undefined;
  topN?: number | undefined;
  crossFilter?: boolean | undefined;
  /** "Sphere (unreviewed)" and the like: shown under the picture when a reference comes from a kit. */
  sourceNote?: string | undefined;
}

export interface DataVisualModel {
  /** The dataset it reads, so a click can filter by the same dataset. */
  source: string;
  family: VisualFamily;
  table: VisualTable;
  references: ChartReference[];
  title?: string | undefined;
  crossFilterColumn?: string | undefined;
  /** The columns drawn as values (the VALUES or COLOUR well and calculated figures); tooltip-only figures are in the table but not drawn. */
  drawn: string[];
  /** The group the series are split by (the LEGEND well), when there is one. */
  legend?: string | undefined;
}


const sortRows = (table: VisualTable, sort: DataVisualProps["sort"], topN?: number): VisualTable => {
  const measure = table.columns.find((c) => c.role !== "DIMENSION");
  const dim = table.columns.find((c) => c.role === "DIMENSION");
  let rows = [...table.rows];
  if (sort && measure) {
    const v = (r: Record<string, unknown>): number => (typeof r[measure.id] === "number" ? (r[measure.id] as number) : Number.NEGATIVE_INFINITY);
    if (sort === "VALUE_DESC") rows.sort((a, b) => v(b) - v(a));
    if (sort === "VALUE_ASC") rows.sort((a, b) => v(a) - v(b));
    if (sort === "LABEL" && dim) rows.sort((a, b) => String(a[dim.id] ?? "").localeCompare(String(b[dim.id] ?? "")));
  } else if (dim) rows.sort((a, b) => String(a[dim.id] ?? "").localeCompare(String(b[dim.id] ?? "")));
  const notes = [...table.notes];
  if (topN && rows.length > topN) { notes.push(`Showing the top ${topN} of ${rows.length}.`); rows = rows.slice(0, topN); }
  return { ...table, rows, notes };
};

export const dataVisualBlock = defineBlock<DataVisualProps, DataVisualModel, DatasetBlockData | undefined>({
  kind: "DATA_VISUAL",
  family: "CHARTS",
  labelKey: "canvas.block.DATA_VISUAL",
  requiresSetup: true,
  needsAlt: true,
  reads: "DATASET",
  highlightable: true,
  picture: (p) => visualFamilyDef(p.family)?.picture ?? "OTHER",
  defaults: () => ({ source: "", family: "BAR", wells: {}, crossFilter: true }),
  validate: (p) => {
    if (!p.source) return [{ message: "Choose the dataset this visual reads." }];
    if (!VISUAL_FAMILIES.includes(p.family)) return [{ message: "Choose the kind of visual." }];
    const gaps = wellGaps(p.family, p.wells, p.calculated ?? []);
    if (gaps.length) return gaps.slice(0, 1).map((message) => ({ message }));
    const refs = referenceProblems(p.references ?? [], visualFamilyDef(p.family)?.references === true);
    if (refs.length) return refs.slice(0, 1).map((message) => ({ message }));
    if (p.topN !== undefined && (!Number.isInteger(p.topN) || p.topN < 1 || p.topN > 100)) return [{ message: "Show between 1 and 100 of the largest." }];
    return [];
  },
  slots: [],
  sizes: { min: { w: 2, h: 2 }, max: { w: 12, h: 10 }, default: { w: 6, h: 4 } },
  lint: [{ id: "DATA_VISUAL_NO_ALT", severity: "WARN", check: (p) => (visualFamilyDef(p.family)?.needsAlt && !p.altText?.trim() ? "Describe what this visual shows, for readers who cannot see it." : null) }],
  resolve: (p, data) => {
    if (!data) return NOT_READ;
    const cat = catalogueWith([data.source]);
    const query = wellsToQuery(p.family, p.wells, data.source.id, { filters: p.filters, calculated: p.calculated, includeDraft: true }, cat);
    const problems = validateVisualQuery(query, cat);
    if (problems.length) return { state: "unavailable", reason: problems[0]!.message };
    if (data.rows.length === 0) return { state: "empty", reason: data.filtered.length ? "Nothing is reported for this selection." : "Nothing is reported in this dataset yet." };
    const shaped = sortRows(shapeTable(data.rows, query, [], cat), p.sort, p.topN);
    const dims = query.groupBy;
    const notes = [rowsNote(data, data.rows.length), ...shaped.notes, ...(p.sourceNote ? [p.sourceNote] : [])];
    const drawn = [...(p.wells.VALUES ?? []), ...(p.wells.COLOUR ?? [])].map((f) => f.ref).filter((r) => query.measures.includes(r)).concat((p.calculated ?? []).map((c) => c.id));
    const legend = p.wells.LEGEND?.[0]?.ref;
    return { state: "ready", model: { source: p.source, family: p.family, table: shaped, references: p.references ?? [], title: p.title, drawn, ...(legend ? { legend } : {}), ...(p.crossFilter !== false && dims[0] ? { crossFilterColumn: dims[0] } : {}) }, notes };
  },
});
