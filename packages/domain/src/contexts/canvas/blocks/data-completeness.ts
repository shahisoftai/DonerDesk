import { completeness, type CompletenessCell } from "../../datasets/completeness.js";
import { PERIOD_KEY_FIELD } from "../../datasets/to-source.js";
import { defineBlock } from "../block-definition.js";
import { NOT_READ, type DatasetBlockData } from "../datasets/dataset-data.js";

/**
 * Who reported, by group and period (Phase 54, §3.11): the units (districts, facilities, partners) that sent at least one figure in a
 * period over the units expected. "Expected" is every unit the dataset has ever named in that group, which the note says plainly; a
 * count of reports received, never a guess. A group with no units shows no share, never 0 %.
 */
export interface DataCompletenessProps { source: string; unitColumn: string; groupColumn?: string | undefined; figures?: string[] | undefined; title?: string | undefined }
export interface DataCompletenessModel { groups: string[]; periods: string[]; cells: CompletenessCell[]; unitLabel: string }

export const dataCompletenessBlock = defineBlock<DataCompletenessProps, DataCompletenessModel, DatasetBlockData | undefined>({
  kind: "DATA_COMPLETENESS",
  family: "TABLES",
  labelKey: "canvas.block.DATA_COMPLETENESS",
  requiresSetup: true,
  reads: "DATASET",
  defaults: () => ({ source: "", unitColumn: "" }),
  validate: (p) => (!p.source ? [{ message: "Choose the dataset." }] : !p.unitColumn ? [{ message: "Choose who reports (a place, facility or partner column)." }] : []),
  slots: [],
  sizes: { min: { w: 4, h: 3 }, max: { w: 12, h: 10 }, default: { w: 12, h: 5 } },
  lint: [],
  resolve: (p, data) => {
    if (!data) return NOT_READ;
    const unitField = data.source.fields.find((f) => f.id === p.unitColumn);
    if (!unitField) return { state: "unavailable", reason: "The column naming who reports is not in this dataset." };
    if (!data.source.fields.some((f) => f.id === PERIOD_KEY_FIELD)) return { state: "unavailable", reason: "This dataset has no period column, so who reported when cannot be counted." };
    const figures = p.figures?.length ? p.figures : data.source.fields.filter((f) => f.role === "MEASURE").map((f) => f.id);
    const rows = data.rows.map((r, i) => ({ rowNo: i, values: r.values as Record<string, string | number | null>, periodKey: typeof r.values[PERIOD_KEY_FIELD] === "string" ? (r.values[PERIOD_KEY_FIELD] as string) : undefined }));
    const groupOf = new Map<string, string>();
    for (const r of rows) {
      const unit = r.values[p.unitColumn];
      if (typeof unit !== "string" || !unit) continue;
      const g = p.groupColumn ? r.values[p.groupColumn] : "All";
      if (!groupOf.has(unit)) groupOf.set(unit, typeof g === "string" && g ? g : "Not stated");
    }
    const expected = new Map<string, string[]>();
    for (const [unit, g] of groupOf) expected.set(g, [...(expected.get(g) ?? []), unit]);
    const periods = [...new Set(rows.map((r) => r.periodKey).filter((x): x is string => Boolean(x)))].sort();
    if (periods.length === 0 || expected.size === 0) return { state: "empty", reason: "Nothing is reported in this dataset yet." };
    const cells = completeness({ rows, unitOf: (r) => (typeof r.values[p.unitColumn] === "string" ? (r.values[p.unitColumn] as string) : null), groupOfUnit: (u) => groupOf.get(u) ?? "Not stated", expected, figures, periods });
    const unitLabel = unitField.label.toLowerCase();
    return { state: "ready", model: { groups: [...expected.keys()].sort(), periods, cells, unitLabel }, notes: [`Expected = every ${unitLabel} that appears in the dataset at least once. A ${unitLabel} reported in a period when its row holds at least one figure.`] };
  },
});
