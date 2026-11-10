import { z } from "zod";

/** The organisation's map context settings (Phase 49.6), as the API answers them. */
export const MapContextSchema = z.object({
  layers: z.array(z.enum(["POPULATION", "HEALTH_FACILITIES", "SETTLEMENTS"])),
  imageryUrl: z.string().nullable(),
  imageryCredit: z.string().nullable(),
  canEdit: z.boolean().optional(),
});
export type MapContextDto = z.infer<typeof MapContextSchema>;

/** The population analysis answer (Phase 49.7): a figure with its source, or the reason there is none. */
export const PopulationAnswerSchema = z.union([
  z.object({ ok: z.literal(true), people: z.number(), cellsCounted: z.number(), cellsWithoutData: z.number(), cellKm: z.number(), source: z.string(), year: z.string() }),
  z.object({ ok: z.literal(false), reason: z.string() }),
]);
export type PopulationAnswerDto = z.infer<typeof PopulationAnswerSchema>;
