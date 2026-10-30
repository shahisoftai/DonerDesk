import { z } from "zod";

export const HomePinSchema = z.object({ id: z.string(), kind: z.string(), ref: z.string(), title: z.string(), detail: z.string(), href: z.string(), available: z.boolean(), shared: z.boolean().optional() });
export type HomePinView = z.infer<typeof HomePinSchema>;
export const HomePinListSchema = z.object({ pins: z.array(HomePinSchema) });
