import { z } from "zod";

/** What the API answers for a person's saved Home layout: positions and flags only (the web re-reads it defensively, see `resolveLayout`). */
export const HomeLayoutResponseSchema = z.object({ layout: z.array(z.unknown()).nullable(), updatedAt: z.string().nullable() });
export const HomeLayoutSavedSchema = z.object({ updatedAt: z.string() });
