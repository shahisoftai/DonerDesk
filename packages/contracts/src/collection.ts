import { z } from "zod";

const KEY = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "Use lower-case letters, digits and underscores, starting with a letter.");

const ConditionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({ field: KEY, op: z.enum(["EQ", "NEQ", "GT", "GTE", "LT", "LTE", "IN", "FILLED", "EMPTY"]), value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]).optional() }),
    z.object({ all: z.array(ConditionSchema).max(20) }),
    z.object({ any: z.array(ConditionSchema).max(20) }),
  ]),
);

export const FormFieldSchema = z.object({
  key: z.string().max(40),
  label: z.string().max(200),
  type: z.enum(["NUMBER", "TEXT", "DATE", "SELECT", "YES_NO", "PLACE", "GPS", "FILE"]),
  required: z.boolean().optional(),
  requiredWhen: ConditionSchema.optional(),
  relevantWhen: ConditionSchema.optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  maxLength: z.number().int().min(1).max(5000).optional(),
  options: z.array(z.object({ value: z.string().max(100), label: z.string().max(200) })).max(100).optional(),
});

export const RecordMappingSchema = z.object({
  indicatorId: z.string().min(1),
  method: z.enum(["COUNT", "SUM"]),
  valueField: z.string().max(40).optional(),
  dateField: z.string().max(40).optional(),
  dedupFields: z.array(z.string().max(40)).max(5).optional(),
});

export const SaveCollectionFormSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  fields: z.array(FormFieldSchema).max(100),
  mappings: z.array(RecordMappingSchema).max(50).default([]),
});
export type SaveCollectionFormInput = z.infer<typeof SaveCollectionFormSchema>;

/** `id` is the client's own key for the submission, so a re-sent one (a bad connection) is stored once. */
export const SubmitRecordSchema = z.object({
  id: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/).optional(),
  answers: z.record(z.unknown()),
});
export type SubmitRecordInput = z.infer<typeof SubmitRecordSchema>;

export const PublicSubmitSchema = SubmitRecordSchema.extend({ submitterName: z.string().trim().max(120).optional() });
export type PublicSubmitInput = z.infer<typeof PublicSubmitSchema>;

export const ReviewRecordSchema = z.object({ decision: z.enum(["ACCEPT", "REJECT", "REOPEN"]), note: z.string().trim().max(2000).optional() });
export type ReviewRecordInput = z.infer<typeof ReviewRecordSchema>;

export const CreateCollectionLinkSchema = z.object({ label: z.string().trim().min(1).max(120), expiresInDays: z.number().int().min(1).max(365).default(30) });
export type CreateCollectionLinkInput = z.infer<typeof CreateCollectionLinkSchema>;

export const ApplyRecordsSchema = z.object({ reportingPeriodId: z.string().min(1) });
export type ApplyRecordsInput = z.infer<typeof ApplyRecordsSchema>;

export const ImportRecordsSchema = z.object({ text: z.string().min(1).max(2_000_000), apply: z.boolean().default(false) });
export type ImportRecordsInput = z.infer<typeof ImportRecordsSchema>;
