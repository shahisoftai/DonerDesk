import { z } from "zod";

/** Phase 54 datasets: request shapes. The domain checks the meaning (`columnProblems`, `validateKit`…); these check the shape only. */
const key = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
/** Mirrors the domain's `COLUMN_KIND_KEYS` and `SEMANTIC_KEYS` (pinned by the datasets contract test). */
export const DATASET_COLUMN_KINDS = ["TEXT", "COUNT", "NUMBER", "AMOUNT", "RATE", "DATE", "MONTH", "WEEK", "YES_NO"] as const;
export const DATASET_SEMANTICS = ["NONE", "PLACE", "PERIOD", "PARTNER", "DONOR", "FACILITY", "SEX", "AGE_GROUP", "PROGRAMME", "CURRENCY"] as const;
export const DatasetColumnSchema = z.object({
  key, label: z.string().trim().min(1).max(120), sourceHeader: z.string().max(200), kind: z.enum(DATASET_COLUMN_KINDS), semantic: z.enum(DATASET_SEMANTICS),
  unit: z.string().max(40).optional(), hideOnShareLinks: z.boolean(), role: z.string().max(60).optional(),
  rateParts: z.object({ numerator: key, denominator: key, percent: z.boolean() }).optional(),
});
export const TidyStepSchema = z.object({ id: z.string().min(1).max(40), type: z.string().max(30), params: z.record(z.unknown()), disabled: z.boolean().optional() });
export const DatasetCheckSchema = z.object({ id: z.string().min(1).max(60), check: z.string().max(30), label: z.string().max(200).optional(), severity: z.enum(["BLOCK", "WARN", "NOTE"]).optional(), params: z.record(z.unknown()) });
export const DatasetFigureSchema = z.object({ id: key, label: z.string().trim().min(1).max(120), op: z.enum(["RATIO", "SUM", "DIFFERENCE", "SHARE"]), terms: z.array(key).min(2).max(8), percent: z.boolean().optional() });

const steps = z.array(TidyStepSchema).max(40).default([]);
const columns = z.array(DatasetColumnSchema).max(200);
export const CheckDatasetUploadSchema = z.object({
  fileKey: z.string().min(1).max(300), steps, columns: columns.optional(), checks: z.array(DatasetCheckSchema).max(40).optional(), kitKey: z.string().max(40).optional(),
  datasetId: z.string().max(80).optional(), mode: z.enum(["REPLACE", "ADD_PERIODS"]).optional(), projectCountry: z.string().max(80).optional(), all: z.boolean().optional(),
});
export type CheckDatasetUploadBody = z.infer<typeof CheckDatasetUploadSchema>;

export const SaveDatasetSchema = z.object({
  name: z.string().trim().min(1).max(120), description: z.string().max(1000).optional(), scope: z.enum(["PROJECT", "ORGANISATION"]), projectId: z.string().max(80).optional(),
  fileKey: z.string().min(1).max(300), fileName: z.string().max(200), steps, columns, figures: z.array(DatasetFigureSchema).max(40).optional(),
  checks: z.array(DatasetCheckSchema).max(40).optional(), kitKey: z.string().max(40).optional(), kitMapping: z.record(z.string().max(64)).optional(), projectCountry: z.string().max(80).optional(),
});
export type SaveDatasetBody = z.infer<typeof SaveDatasetSchema>;

export const AddDatasetVersionSchema = z.object({ fileKey: z.string().min(1).max(300), fileName: z.string().max(200), mode: z.enum(["REPLACE", "ADD_PERIODS"]), steps: z.array(TidyStepSchema).max(40).optional(), columns: columns.optional(), projectCountry: z.string().max(80).optional() });
export const DecideDatasetVersionSchema = z.object({ accept: z.boolean(), note: z.string().max(1000).optional() });
export const UpdateDatasetSchema = z.object({ name: z.string().max(120).optional(), description: z.string().max(1000).optional(), sharePolicy: z.object({ hidden: z.array(key).max(200) }).optional(), expectedUpdatedAt: z.string().max(40).optional() });
export const DatasetRestrictionSchema = z.object({
  restricted: z.boolean(),
  restriction: z.object({ lawfulBasis: z.string().max(30), purpose: z.string().max(500), retainUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), viewerIds: z.array(z.string().max(80)).max(50) }).optional(),
});
export const DatasetLinkSchema = z.object({ indicatorId: z.string().min(1).max(80), figureRef: z.string().min(1).max(64), filters: z.array(z.object({ column: key, values: z.array(z.string().max(200)).min(1).max(50) })).max(5).optional(), byPlace: z.boolean().optional() });
export const DatasetKitPagesSchema = z.object({ kitKey: z.string().max(40).optional(), title: z.string().max(120).optional(), pageKeys: z.array(z.string().max(40)).max(20).optional() });
export const DatasetConnectorSchema = z.object({
  config: z.object({ kind: z.string().max(20), serverUrl: z.string().max(300), dataElements: z.array(z.string().max(40)).max(50), orgUnits: z.array(z.string().max(40)).max(50), periods: z.string().max(200), schedule: z.enum(["MANUAL", "DAILY", "WEEKLY", "MONTHLY"]) }),
  credential: z.string().max(500).optional(),
}).nullable();
export const DatasetListQuerySchema = z.object({ projectId: z.string().max(80).optional() });

/** A viewer's slicer choices, sent with a canvas resolve as one JSON value (`ds`). */
export const DatasetFilterListSchema = z.array(z.object({ source: z.string().max(100), column: key.or(z.literal("_place_id")).or(z.literal("_period")), values: z.array(z.string().max(200)).max(50) })).max(20);
export function datasetFiltersOf(raw: string | undefined): z.infer<typeof DatasetFilterListSchema> {
  if (!raw) return [];
  try { const parsed = DatasetFilterListSchema.safeParse(JSON.parse(raw)); return parsed.success ? parsed.data : []; } catch { return []; }
}
