import { z } from "zod";

/** What the api answers for the Visual Studio's data (Phase 48.17); read with the same shape the handlers write. */
const Cell = z.union([z.string(), z.number(), z.null()]);

export const VisualTableSchema = z.object({
  columns: z.array(z.object({ id: z.string(), ref: z.string(), label: z.string(), role: z.enum(["DIMENSION", "MEASURE", "CALCULATED"]), type: z.string(), unit: z.string().optional() })),
  rows: z.array(z.record(Cell)),
  notes: z.array(z.string()),
});

export const VisualAnswerSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("ready"), table: VisualTableSchema, asOf: z.string(), sources: z.array(z.string()), versions: z.record(z.number()), epoch: z.string() }),
  z.object({ state: z.literal("unavailable"), reason: z.string() }),
]);
export type VisualAnswerView = z.infer<typeof VisualAnswerSchema>;

export const CatalogueSchema = z.object({
  sources: z.array(z.object({
    id: z.string(), label: z.string(), description: z.string(), grain: z.string(), guest: z.boolean(), allowed: z.boolean(), connected: z.boolean(),
    fields: z.array(z.object({ id: z.string(), label: z.string(), meaning: z.string(), role: z.enum(["DIMENSION", "MEASURE"]), type: z.string(), unit: z.string().optional(), additive: z.boolean().optional(), money: z.boolean().optional(), available: z.boolean() })),
  })),
  hits: z.array(z.object({ source: z.string(), field: z.string(), score: z.number() })),
});
export type CatalogueView = z.infer<typeof CatalogueSchema>;

export const VersionsSchema = z.object({ projects: z.array(z.object({ projectId: z.string(), epoch: z.string(), versions: z.record(z.number()) })) });
export type VersionsView = z.infer<typeof VersionsSchema>;
