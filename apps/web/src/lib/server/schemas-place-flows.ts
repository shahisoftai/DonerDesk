import { z } from "zod";

/** What the api answers for the movements between a project's places (Phase 48.12). */
export const PlaceFlowSchema = z.object({ id: z.string(), fromPlaceId: z.string(), from: z.string(), toPlaceId: z.string(), to: z.string(), what: z.string(), quantity: z.number(), unit: z.string(), note: z.string().optional() });
export const PlaceFlowListSchema = z.object({ flows: z.array(PlaceFlowSchema), canEdit: z.boolean(), limit: z.number() });
export type PlaceFlowView = z.infer<typeof PlaceFlowSchema>;
