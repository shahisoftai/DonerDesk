import { z } from "zod";

/** The Infographic Studio's wire shapes (Phase 31). The design config is validated again in the domain on every save —
 * here the schema only proves the row is well-formed enough to open. The enriched data read is
 * passthrough: its figures are rendered through the studio view models, which tolerate absence. */

export const InfographicRecordSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  templateId: z.string(),
  templateVersion: z.number(),
  configJson: z.string(),
  updatedAt: z.string(),
  exportCount: z.number().optional(),
});

export const InfographicsListSchema = z.object({ items: z.array(InfographicRecordSchema) });
export type InfographicsListResponse = z.infer<typeof InfographicsListSchema>;

export const InfographicExportSchema = z.object({
  id: z.string(),
  format: z.string(),
  createdAt: z.string(),
  generatedById: z.string(),
});
export const InfographicExportsSchema = z.object({ items: z.array(InfographicExportSchema) });
export type InfographicExportsResponse = z.infer<typeof InfographicExportsSchema>;

/** The enriched read: passthrough on purpose — the studio view models render whatever is present and
 * treat everything absent as "Not yet reported". */
export const InfographicDataSchema = z.object({ projectId: z.string(), provenance: z.object({ generatedAt: z.string(), unverifiedValues: z.number() }).passthrough() }).passthrough();
