import { runReport, validateReportQuery, type ReportQuery, type ReportTable } from "../../reporting/report-query.js";
import type { DatasetResult } from "../../reporting/dataset-query.js";
import { projectSlot } from "../binding.js";
import { defineBlock } from "../block-definition.js";

export interface TableProps { query: ReportQuery; title?: string | undefined }

/** A saved-report table. A gap is "Not measured", never 0; nothing is added across indicators (`runReport`). */
export const tableBlock = defineBlock<TableProps, ReportTable, DatasetResult>({
  kind: "TABLE",
  family: "TABLES",
  labelKey: "canvas.block.TABLE",
  requiresSetup: true,
  defaults: () => ({ query: undefined as unknown as ReportQuery }),
  validate: ({ query }) => (query ? validateReportQuery(query).slice(0, 1).map((p) => ({ message: p.message })) : [{ message: "A table needs its question." }]),
  slots: [projectSlot(["PERIOD", "DRAFTS"])],
  sizes: { min: { w: 3, h: 2 }, max: { w: 12, h: 10 }, default: { w: 6, h: 4 } },
  lint: [],
  resolve: ({ query }, data) => ({ state: "ready", model: runReport(data, query), notes: [] }),
});
