import { z } from "zod";

/**
 * The Visual Studio's data questions (Phase 48.17). The shape is checked here; whether the question is allowed (a rate summed,
 * money mixed, a source not open to the asker) is decided by the domain's `validateVisualQuery` and the service, so the rules live
 * in one place and this contract cannot drift from them.
 */
const Ref = z.string().min(1).max(80);

export const CalculatedFieldSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(80),
  op: z.enum(["RATIO", "SUM", "DIFFERENCE", "SHARE"]),
  terms: z.array(Ref).min(2).max(8),
  percent: z.boolean().optional(),
});

export const VisualQuerySchema = z.object({
  source: z.string().min(1).max(40),
  measures: z.array(Ref).max(12),
  groupBy: z.array(Ref).max(4),
  filters: z.array(z.object({ field: Ref, values: z.array(z.string().max(200)).max(100) })).max(8).optional(),
  aggregate: z.record(z.enum(["SUM", "VALUE", "LATEST"])).optional(),
  calculated: z.array(CalculatedFieldSchema).max(6).optional(),
  fromPeriodId: z.string().max(64).optional(),
  toPeriodId: z.string().max(64).optional(),
  includeDraft: z.boolean(),
  currency: z.string().length(3).optional(),
  limit: z.number().int().min(1).max(5000).optional(),
});

export const QueryVisualDataSchema = z.object({ projectId: z.string().min(1).max(64), query: VisualQuerySchema });
export type QueryVisualDataInput = z.infer<typeof QueryVisualDataSchema>;

export const VisualDataCatalogueQuerySchema = z.object({ search: z.string().max(100).optional() });
export const VisualDataVersionQuerySchema = z.object({ projects: z.string().min(1).max(2000) });
