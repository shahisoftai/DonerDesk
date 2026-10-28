import { z } from "zod";

/** What the Chart Studio gets back from `POST /v1/datasets/resolve` (a `DatasetResult`, domain `dataset-query.ts`). */
export const DatasetResultSchema = z.object({
  indicators: z.array(z.object({
    id: z.string(), code: z.string(), name: z.string(), level: z.string().nullable(), type: z.string(),
    unit: z.string().nullish().transform((v) => v ?? undefined), baseline: z.string(), target: z.string(), isRate: z.boolean(),
    lowerIsBetter: z.boolean().optional(), calculation: z.string().optional(),
    targetSchedule: z.array(z.object({ asOf: z.string(), target: z.string() })).optional(),
  })),
  periods: z.array(z.object({ id: z.string(), label: z.string(), start: z.string(), end: z.string(), reportType: z.string(), locked: z.boolean(), reportStatus: z.string().optional() })),
  points: z.array(z.object({ indicatorId: z.string(), periodId: z.string(), periodLabel: z.string(), value: z.number().nullable(), status: z.string(), verified: z.boolean(), breakdown: z.array(z.object({ dimension: z.string(), category: z.string(), value: z.string() })).optional() })),
  finance: z.array(z.object({ periodId: z.string(), periodLabel: z.string(), currency: z.string(), budget: z.number().nullable(), expenditure: z.number().nullable(), burnRatePercent: z.number().nullable(), verified: z.boolean() })),
  /** Attached only when the chart asked for it and the viewer may see it. */
  plan: z.array(z.object({ id: z.string(), title: z.string(), kind: z.enum(["ACTIVITY", "MILESTONE"]), start: z.string(), end: z.string(), status: z.string(), signal: z.string(), signalLabel: z.string() })).optional(),
  activityDays: z.array(z.object({ date: z.string(), count: z.number() })).optional(),
  budget: z.array(z.object({ donor: z.string(), category: z.string(), currency: z.string(), budgeted: z.number(), spent: z.number() })).optional(),
  places: z.array(z.object({ name: z.string(), path: z.string(), level: z.number(), value: z.number().nullable(), partly: z.boolean(), latitude: z.number().optional(), longitude: z.number().optional() })).optional(),
  missingIndicatorIds: z.array(z.string()),
  mixedUnits: z.boolean(),
  withheldDrafts: z.number(),
  provenance: z.object({ points: z.number(), unverified: z.number() }),
  notes: z.array(z.string()),
});

export const ResolvedDatasetsSchema = z.object({
  datasets: z.array(z.union([z.object({ key: z.string(), dataset: DatasetResultSchema }), z.object({ key: z.string(), unavailable: z.string() })])),
});

export const SavedChartViewSchema = z.object({
  id: z.string(), name: z.string(), scope: z.enum(["MINE", "PROJECT"]), projectId: z.string(), mine: z.boolean(), canEdit: z.boolean(),
  spec: z.record(z.unknown()), updatedAt: z.string(),
});
export type SavedChartView = z.infer<typeof SavedChartViewSchema>;
export const SavedChartListSchema = z.object({ charts: z.array(SavedChartViewSchema) });
export const SavedChartWrittenSchema = z.object({ id: z.string(), updatedAt: z.string() });

/** One chart with its earlier versions (newest first), as `GET /v1/charts/:id` answers. */
export const SavedChartDetailSchema = SavedChartViewSchema.extend({
  versions: z.array(z.object({ at: z.string(), name: z.string(), spec: z.record(z.unknown()) })),
});
export type SavedChartDetail = z.infer<typeof SavedChartDetailSchema>;
