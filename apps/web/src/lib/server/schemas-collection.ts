import { z } from "zod";

export const FormFieldViewSchema = z.object({
  key: z.string(), label: z.string(), type: z.enum(["NUMBER", "TEXT", "DATE", "SELECT", "YES_NO", "PLACE", "GPS"]),
  required: z.boolean().optional(), requiredWhen: z.unknown().optional(), relevantWhen: z.unknown().optional(),
  min: z.number().optional(), max: z.number().optional(), maxLength: z.number().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
});

export const RecordMappingViewSchema = z.object({
  indicatorId: z.string(), method: z.enum(["COUNT", "SUM"]), valueField: z.string().optional(), dateField: z.string().optional(), dedupFields: z.array(z.string()).optional(),
});

export const CollectionFormSchema = z.object({
  id: z.string(), projectId: z.string(), name: z.string(), description: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]), fields: z.array(FormFieldViewSchema), mappings: z.array(RecordMappingViewSchema),
  counts: z.object({ PENDING: z.number(), ACCEPTED: z.number(), REJECTED: z.number() }), updatedAt: z.string(),
});
export type CollectionFormView = z.infer<typeof CollectionFormSchema>;
export const CollectionFormListSchema = z.object({ forms: z.array(CollectionFormSchema) });

export const CollectionRecordSchema = z.object({
  id: z.string(), formId: z.string(), answers: z.record(z.unknown()), submittedOn: z.string(), source: z.enum(["USER", "LINK"]),
  submitter: z.string(), status: z.enum(["PENDING", "ACCEPTED", "REJECTED"]), reviewNote: z.string().optional(),
});
export type CollectionRecordView = z.infer<typeof CollectionRecordSchema>;
export const CollectionRecordListSchema = z.object({ records: z.array(CollectionRecordSchema) });

export const CollectionTotalsSchema = z.object({
  totals: z.array(z.object({
    indicatorId: z.string(), indicatorCode: z.string(), method: z.enum(["COUNT", "SUM"]),
    periods: z.array(z.object({ periodId: z.string(), label: z.string(), value: z.string(), recordCount: z.number() })),
    outsidePeriods: z.number(), missingFigure: z.number(), duplicates: z.number(),
  })),
});
export type CollectionTotalsView = z.infer<typeof CollectionTotalsSchema>["totals"];

export const CollectionLinkSchema = z.object({ id: z.string(), label: z.string(), expiresAt: z.string(), live: z.boolean(), revoked: z.boolean() });
export type CollectionLinkView = z.infer<typeof CollectionLinkSchema>;
export const CollectionLinkListSchema = z.object({ links: z.array(CollectionLinkSchema) });
export const CollectionLinkCreatedSchema = z.object({ id: z.string(), token: z.string(), expiresAt: z.string() });

export const SubmitResultSchema = z.object({ id: z.string(), duplicate: z.boolean(), ignored: z.array(z.string()).optional() });
export const ApplyResultSchema = z.object({ saved: z.number(), skipped: z.number(), indicators: z.array(z.string()) });

export const SheetTemplateSchema = z.object({ fileName: z.string(), text: z.string() });
export const RecordImportPreviewSchema = z.object({
  total: z.number(), valid: z.number(), invalid: z.number(), unknownColumns: z.array(z.string()), missingColumns: z.array(z.string()),
  rows: z.array(z.object({ rowNumber: z.number(), problems: z.array(z.string()), ignored: z.array(z.string()) })),
  errorFile: z.string().optional(), saved: z.number(),
});
export type RecordImportPreview = z.infer<typeof RecordImportPreviewSchema>;
