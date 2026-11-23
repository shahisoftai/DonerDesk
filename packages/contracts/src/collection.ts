import { z } from "zod";

const KEY = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "Use lower-case letters, digits and underscores, starting with a letter.");

const ConditionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({ field: KEY, op: z.enum(["EQ", "NEQ", "GT", "GTE", "LT", "LTE", "IN", "FILLED", "EMPTY", "CONTAINS"]), value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]).optional() }),
    z.object({ all: z.array(ConditionSchema).max(20) }),
    z.object({ any: z.array(ConditionSchema).max(20) }),
  ]),
);

const Option = z.object({ value: z.string().max(100), label: z.string().max(300) });
const Wording = z.record(z.string().min(2).max(8), z.string().max(2000));
const GridColumnSchema = z.object({
  key: z.string().max(40), label: z.string().max(300), type: z.enum(["NUMBER", "TEXT", "SELECT", "YES_NO", "FILE"]),
  required: z.boolean().optional(), allowNotApplicable: z.boolean().optional(), min: z.number().optional(), max: z.number().optional(),
  options: z.array(Option).max(100).optional(), labels: Wording.optional(),
});
const FIELD_TYPES = ["NUMBER", "TEXT", "DATE", "SELECT", "YES_NO", "PLACE", "GPS", "FILE", "MULTI_SELECT", "SIGNATURE", "SECTION", "NOTE", "REPEAT", "GRID", "CALCULATED"] as const;

const FieldBase = z.object({
  key: z.string().max(40),
  label: z.string().max(2000),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().optional(),
  requiredWhen: ConditionSchema.optional(),
  relevantWhen: ConditionSchema.optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  maxLength: z.number().int().min(1).max(5000).optional(),
  options: z.array(Option).max(100).optional(),
  help: z.string().max(4000).optional(),
  labels: Wording.optional(),
  helpLabels: Wording.optional(),
  allowNotApplicable: z.boolean().optional(),
  carryForward: z.boolean().optional(),
  verify: z.object({ evidenceField: z.string().max(40).optional(), evidenceWhen: z.array(z.enum(["OBSERVED", "RECORD_CHECKED", "REPORTED"])).max(3).optional() }).optional(),
  minRows: z.number().int().min(0).max(100).optional(),
  maxRows: z.number().int().min(1).max(100).optional(),
  rowLabel: z.string().max(60).optional(),
  rows: z.array(z.object({ key: z.string().max(40), label: z.string().max(300), labels: Wording.optional() })).max(120).optional(),
  columns: z.array(GridColumnSchema).max(12).optional(),
  formula: z.string().max(400).optional(),
  decimals: z.number().int().min(0).max(10).optional(),
  signer: z.string().max(120).optional(),
});

/** A question; a repeat holds its own questions one level down. */
export const FormFieldSchema: z.ZodType<unknown> = FieldBase.extend({ fields: z.array(z.lazy(() => FormFieldSchema)).max(40).optional() });

export const ConstraintSchema = z.object({ kind: z.enum(["LTE", "GTE", "SUM_EQUALS", "ONE_OF_REQUIRED"]), fields: z.array(z.string().max(40)).min(2).max(20), message: z.string().max(300).optional() });

export const ScoreRulesSchema = z.object({
  sections: z.array(z.object({
    key: z.string().min(1).max(40), title: z.string().min(1).max(200), weight: z.number().positive().max(1000).optional(), relevantWhen: ConditionSchema.optional(),
    items: z.array(z.object({ path: z.string().min(1).max(200), label: z.string().max(300).optional(), points: z.record(z.string().max(100), z.number().min(0).max(1000)) })).min(1).max(600),
  })).min(1).max(80),
  bands: z.array(z.object({ min: z.number().min(0).max(100), label: z.string().min(1).max(60), tone: z.enum(["GOOD", "FAIR", "POOR"]) })).min(1).max(8),
  minAnsweredShare: z.number().min(0).max(1).optional(),
  illustrative: z.boolean().optional(),
});

export const RecordMappingSchema = z.object({
  indicatorId: z.string().min(1),
  method: z.enum(["COUNT", "SUM", "COUNT_WHERE", "PERCENT_WHERE", "AVERAGE_SCORE"]),
  valueField: z.string().max(40).optional(),
  dateField: z.string().max(40).optional(),
  dedupFields: z.array(z.string().max(40)).max(5).optional(),
  where: ConditionSchema.optional(),
  latestPerFacility: z.boolean().optional(),
});

export const SaveCollectionFormSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  fields: z.array(FormFieldSchema).max(600),
  mappings: z.array(RecordMappingSchema).max(50).default([]),
  constraints: z.array(ConstraintSchema).max(100).optional(),
  subject: z.enum(["FACILITY", "PLACE", "NONE"]).optional(),
  score: ScoreRulesSchema.optional(),
  languages: z.array(z.string().min(2).max(8)).max(10).optional(),
});
export type SaveCollectionFormInput = z.infer<typeof SaveCollectionFormSchema>;

/** `id` is the client's own key for the submission, so a re-sent one (a bad connection) is stored once. */
export const SubmitRecordSchema = z.object({
  id: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/).optional(),
  answers: z.record(z.unknown()),
  /** The facility or place the record is about (a form with a subject asks for it). */
  placeId: z.string().min(1).max(64).optional(),
  /** How the answers that ask for it were established, by field key. */
  how: z.record(z.string().max(40), z.string().max(20)).optional(),
  /** When the person began (the draft's first save), as an ISO time. */
  startedAt: z.string().datetime().optional(),
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

export const SaveConnectorSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["KOBOTOOLBOX", "SURVEYCTO"]),
  serverUrl: z.string().trim().min(8).max(300),
  sourceId: z.string().trim().min(3).max(80),
  /** The API token (KoboToolbox) or `user:password` (SurveyCTO). Required when the connector is made; leave out to keep the saved one. */
  credential: z.string().min(3).max(500).optional(),
  fieldMap: z.array(z.object({ sourceField: z.string().trim().min(1).max(200), formKey: z.string().min(1).max(40) })).max(100),
});
export type SaveConnectorInput = z.infer<typeof SaveConnectorSchema>;

export const SyncConnectorSchema = z.object({ apply: z.boolean().default(false) });
export type SyncConnectorInput = z.infer<typeof SyncConnectorSchema>;
