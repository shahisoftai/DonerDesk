import { z } from "zod";

/**
 * A question as the server sends it. A field now carries a lot more than before (grids, repeats, wording by language, formulas…), and
 * the domain's own `FormField` type is the one description of it, so only the three things every field has are checked here and the
 * rest passes through untouched (a stripped property would silently break a form).
 */
export const FormFieldViewSchema = z.object({
  key: z.string(), label: z.string(),
  type: z.enum(["NUMBER", "TEXT", "DATE", "SELECT", "YES_NO", "PLACE", "GPS", "FILE", "MULTI_SELECT", "SIGNATURE", "SECTION", "NOTE", "REPEAT", "GRID", "CALCULATED"]),
}).passthrough();

export const RecordMappingViewSchema = z.object({
  indicatorId: z.string(), method: z.enum(["COUNT", "SUM", "COUNT_WHERE", "PERCENT_WHERE", "AVERAGE_SCORE"]), valueField: z.string().optional(), dateField: z.string().optional(), dedupFields: z.array(z.string()).optional(),
  where: z.unknown().optional(), latestPerFacility: z.boolean().optional(),
});

export const CollectionFormSchema = z.object({
  id: z.string(), projectId: z.string(), name: z.string(), description: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]), fields: z.array(FormFieldViewSchema), mappings: z.array(RecordMappingViewSchema),
  counts: z.object({ PENDING: z.number(), ACCEPTED: z.number(), REJECTED: z.number() }), updatedAt: z.string(),
  /** Phase 62: rules across answers, what a record is about, how it scores and the languages of its wording (shapes are the domain's). */
  constraints: z.array(z.unknown()).optional(), subject: z.enum(["FACILITY", "PLACE", "NONE"]).optional(), score: z.unknown().optional(), languages: z.array(z.string()).optional(),
});
export type CollectionFormView = z.infer<typeof CollectionFormSchema>;
export const CollectionFormListSchema = z.object({ forms: z.array(CollectionFormSchema) });

export const CollectionRecordSchema = z.object({
  id: z.string(), formId: z.string(), answers: z.record(z.unknown()), submittedOn: z.string(), source: z.enum(["USER", "LINK", "CONNECTOR"]),
  submitter: z.string(), status: z.enum(["PENDING", "ACCEPTED", "REJECTED"]), reviewNote: z.string().optional(),
  places: z.record(z.object({ status: z.enum(["RESOLVED", "AMBIGUOUS", "UNRESOLVED"]), label: z.string() })).optional(),
  files: z.record(z.object({ id: z.string(), name: z.string() })).optional(),
  placeId: z.string().optional(), placeName: z.string().optional(), placePath: z.string().optional(), visitNo: z.number().optional(),
  score: z.object({ overall: z.number().nullable(), band: z.string().optional(), tone: z.string().optional(), answered: z.number(), total: z.number() }).optional(),
  flags: z.array(z.object({ code: z.string(), detail: z.string() })).optional(), how: z.record(z.string()).optional(),
});
export type CollectionRecordView = z.infer<typeof CollectionRecordSchema>;
export const CollectionRecordListSchema = z.object({ records: z.array(CollectionRecordSchema) });

export const CollectionTotalsSchema = z.object({
  totals: z.array(z.object({
    indicatorId: z.string(), indicatorCode: z.string(), method: z.enum(["COUNT", "SUM", "COUNT_WHERE", "PERCENT_WHERE", "AVERAGE_SCORE"]),
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

export const ConnectorSchema = z.object({
  id: z.string(), name: z.string(), kind: z.enum(["KOBOTOOLBOX", "SURVEYCTO"]), kindLabel: z.string(), serverUrl: z.string(), sourceId: z.string(),
  fieldMap: z.array(z.object({ sourceField: z.string(), formKey: z.string() })), hasCredential: z.boolean(),
  lastSyncAt: z.string().optional(), lastSync: z.record(z.unknown()).optional(),
});
export type ConnectorView = z.infer<typeof ConnectorSchema>;
export const ConnectorListSchema = z.object({ connectors: z.array(ConnectorSchema), available: z.boolean() });
export const SyncResultSchema = z.object({
  read: z.number(), created: z.number(), alreadyHad: z.number(), rejected: z.number(), skipped: z.number(), problems: z.array(z.string()), applied: z.boolean(), more: z.boolean(),
});
export type SyncResultView = z.infer<typeof SyncResultSchema>;
