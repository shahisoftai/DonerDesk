import { activityRows, disaggregationRows, indicatorValueRows, periodRows, planRows, spendingRows, type DataSheet, type VisualQuery, type VisualRow } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDatasetExtras } from "../../services/dataset-extras.js";

/**
 * One reader per catalogue source. A reader says which fields it can supply (`fields`) and reads rows through an existing handler or
 * service; a source with no reader answers "being connected", never an empty table. `ReadScope` memoises the data sheet so a
 * question that touches several sources of a project reads it once.
 */
export interface ReadScope {
  ctx: AuthenticatedContext;
  projectId: string;
  query: VisualQuery;
  sheet(): Promise<DataSheet | undefined>;
}

export interface SourceReader {
  source: string;
  /** The catalogue fields this reader fills; asking for another is refused with a plain sentence, not answered with blanks. */
  fields: ReadonlySet<string>;
  /** undefined = the data could not be read just now (never an empty list). */
  read(scope: ReadScope): Promise<VisualRow[] | undefined>;
}

const set = (...ids: string[]): ReadonlySet<string> => new Set(ids);

const sheetOptions = (q: VisualQuery) => ({ fromPeriodId: q.fromPeriodId, toPeriodId: q.toPeriodId });

export function createSourceReaders(extras?: IDatasetExtras): SourceReader[] {
  const readers: SourceReader[] = [
    {
      source: "indicator-values",
      fields: set("indicator", "period", "level", "status", "period_value", "cumulative", "target", "baseline", "percent_of_target", "rate_value"),
      read: async (s) => { const sheet = await s.sheet(); return sheet ? indicatorValueRows(sheet, sheetOptions(s.query)) : undefined; },
    },
    {
      source: "disaggregation",
      fields: set("indicator", "period", "dimension", "category", "group_value"),
      read: async (s) => { const sheet = await s.sheet(); return sheet ? disaggregationRows(sheet, sheetOptions(s.query)) : undefined; },
    },
    {
      source: "periods",
      fields: set("period_label"),
      read: async (s) => { const sheet = await s.sheet(); return sheet ? periodRows(sheet, sheetOptions(s.query)) : undefined; },
    },
  ];
  if (extras) {
    readers.push(
      { source: "plan", fields: set("activity", "delivery_state", "planned_start", "planned_end", "activity_count"), read: async (s) => { const r = await extras.plan(s.ctx, s.projectId); return r ? planRows(r) : undefined; } },
      { source: "activities", fields: set("activity_date", "done_count"), read: async (s) => { const r = await extras.activityDays(s.ctx, s.projectId); return r ? activityRows(r) : undefined; } },
      { source: "spending", fields: set("currency", "category", "result", "budgeted", "spent"), read: async (s) => { const r = await extras.budget(s.ctx, s.projectId); return r ? spendingRows(r) : undefined; } },
    );
  }
  return readers;
}
