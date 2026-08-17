import { z } from "zod";

export const IdResponseSchema = z.object({ id: z.string() });

export const OkResponseSchema = z.object({ ok: z.boolean() });

export const UploadResponseSchema = z.object({ id: z.string(), fileUrl: z.string() });

export const PolishActivityResponseSchema = z.object({
  narrative: z.string(),
  model: z.string(),
});

export const TemplateCreatedResponseSchema = z.object({
  id: z.string(),
  sections: z.array(z.unknown()),
  summary: z.unknown().optional(),
});

export const GeneratedDraftResponseSchema = z.object({
  draftId: z.string(),
  sectionIds: z.array(z.string()),
});

export const DetectMissingResponseSchema = z.object({ created: z.number().int().nonnegative() });

export const BulkResolveResponseSchema = z.object({ resolved: z.number().int().nonnegative(), skipped: z.number().int().nonnegative() });

export const UpdateSectionResponseSchema = z.object({ version: z.string() });

export const UpdateSectionChartResponseSchema = z.object({
  version: z.string(),
  chartConfig: z
    .object({
      type: z.enum(["BAR", "LINE", "PIE", "AREA", "RADAR", "GAUGE"]),
      dataBinding: z.enum(["INDICATOR_COMPARISON", "INDICATOR_ACHIEVEMENT", "STATUS_DISTRIBUTION"]),
      options: z.record(z.string(), z.unknown()).optional(),
    })
    .nullable(),
});

export const RewriteSectionResponseSchema = z.object({ version: z.string(), content: z.string() });

export const InviteUserResponseSchema = z.object({
  invitationId: z.string(),
  token: z.string(),
});
