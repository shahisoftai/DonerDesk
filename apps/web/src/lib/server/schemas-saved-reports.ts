import { z } from "zod";

export const SavedReportViewSchema = z.object({
  id: z.string(), name: z.string(), scope: z.enum(["MINE", "PROJECT"]), projectId: z.string(), mine: z.boolean(), canEdit: z.boolean(),
  query: z.record(z.unknown()), updatedAt: z.string(),
});
export type SavedReportView = z.infer<typeof SavedReportViewSchema>;
export const SavedReportListSchema = z.object({ reports: z.array(SavedReportViewSchema) });
export const SavedReportWrittenSchema = z.object({ id: z.string(), updatedAt: z.string() });
