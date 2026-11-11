import { z } from "zod";

const Type = z.object({ key: z.string(), label: z.string(), sector: z.string().optional() });
export const FacilityTypesSchema = z.object({ types: z.array(Type), suggested: z.record(z.array(Type)), canEdit: z.boolean() });
export type FacilityTypes = z.infer<typeof FacilityTypesSchema>;
