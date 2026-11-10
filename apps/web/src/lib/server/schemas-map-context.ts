import { z } from "zod";

/** The organisation's map context settings (Phase 49.6), as the API answers them. */
export const MapContextSchema = z.object({
  layers: z.array(z.enum(["POPULATION", "HEALTH_FACILITIES", "SETTLEMENTS"])),
  imageryUrl: z.string().nullable(),
  imageryCredit: z.string().nullable(),
  canEdit: z.boolean().optional(),
});
export type MapContextDto = z.infer<typeof MapContextSchema>;
