import { z } from "zod";

/**
 * Infographic Studio (Phase 31): the wire shapes for saved designs and their exports. The
 * composition is validated again in the domain (`validateConfig`) — this schema only fixes the
 * wire contract and the obvious sizes, so a bad design is refused with one clear sentence.
 */

export const INFOGRAPHIC_TEMPLATE_IDS = ["OVERVIEW", "PROGRESS", "RESULTS", "BUDGET", "THEMATIC", "CLOSURE"] as const;

export const InfographicSectionKindSchema = z.enum([
  "KPIS",
  "CHART",
  "LOCATION_RESULTS",
  "LOCATION_COMPARISON",
  "REACH",
  "ACTIVITIES_BY_LOCATION",
  "MAP",
  "TEXT",
]);

export const InfographicChartSpecSchema = z
  .object({
    template: z.string().min(1).max(60),
    indicatorIds: z.array(z.string().min(1).max(64)).max(30),
    measure: z.enum(["PERIOD", "CUMULATIVE", "PERCENT_OF_TARGET"]),
    type: z.enum(["BAR", "LINE", "PIE", "AREA", "RADAR", "GAUGE"]),
    showTarget: z.boolean().optional(),
    title: z.string().max(120).optional(),
  })
  .strict();

export const InfographicSectionSchema = z
  .object({
    kind: InfographicSectionKindSchema,
    title: z.string().max(120).optional(),
    text: z.string().max(600).optional(),
    chart: InfographicChartSpecSchema.optional(),
    indicatorIds: z.array(z.string().min(1).max(64)).max(30).optional(),
    locationKeys: z.array(z.string().min(1).max(120)).max(100).optional(),
    size: z.enum(["THIRD", "HALF", "FULL"]).optional(),
    hidden: z.boolean().optional(),
  })
  .strict();

export const InfographicConfigSchema = z
  .object({
    templateId: z.enum(INFOGRAPHIC_TEMPLATE_IDS),
    templateVersion: z.number().int().min(1),
    title: z.string().max(120).optional(),
    periodFromId: z.string().min(1).max(64).optional(),
    periodToId: z.string().min(1).max(64).optional(),
    locationKeys: z.array(z.string().min(1).max(120)).max(100).optional(),
    branding: z.boolean().optional(),
    sections: z.array(InfographicSectionSchema).min(1).max(24),
  })
  .strict();

export const CreateInfographicSchema = z
  .object({
    title: z.string().max(120).optional(),
    templateId: z.enum(INFOGRAPHIC_TEMPLATE_IDS),
    /** Absent: start from the template's own default composition. */
    config: InfographicConfigSchema.optional(),
  })
  .strict();

export const UpdateInfographicSchema = z
  .object({
    title: z.string().max(120).optional(),
    config: InfographicConfigSchema,
  })
  .strict();

export const ExportInfographicSchema = z
  .object({
    format: z.enum(["PNG", "PDF"]),
    /** Site pins resolved in the browser (no server-side geocoding); only what the map draws. */
    mapPoints: z
      .array(
        z
          .object({
            name: z.string().max(120),
            lat: z.number().min(-90).max(90),
            lng: z.number().min(-180).max(180),
            worst: z.enum(["ON_TIME", "LATE", "DONE", "CANCELLED"]),
            count: z.number().int().min(1).max(999).optional(),
          })
          .strict(),
      )
      .max(400)
      .optional(),
  })
  .strict();

export type CreateInfographicInput = z.infer<typeof CreateInfographicSchema>;
export type UpdateInfographicInput = z.infer<typeof UpdateInfographicSchema>;
export type ExportInfographicInput = z.infer<typeof ExportInfographicSchema>;
export type InfographicConfigInput = z.infer<typeof InfographicConfigSchema>;
