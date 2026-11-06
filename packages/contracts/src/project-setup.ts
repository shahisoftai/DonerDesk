import { z } from "zod";
import { CreateProjectSchema } from "./projects.js";

/**
 * Project setup assistant (Phase 36) wire shapes. The rules live in the domain (`packages/domain/src/contexts/project-setup`);
 * these schemas carry the proposal between the api and the web and re-check it at the edge. `SETUP_PROBLEM_CODES` and
 * `SETUP_AREA_KEYS` mirror the domain lists and are pinned by `test/architecture-boundaries.test.mjs`.
 */

/** A setup is built from at most this many documents, all about the same project. */
export const SETUP_MAX_DOCUMENTS = 5;

export const SETUP_AREA_KEYS = ["FACTS", "LOGFRAME", "INDICATORS", "PERIODS", "PLAN", "PLACES", "FUNDING_BUDGET", "RISKS"] as const;
export type SetupAreaKey = (typeof SETUP_AREA_KEYS)[number];
export const SetupAreaKeySchema = z.enum(SETUP_AREA_KEYS);

export const SETUP_PROBLEM_CODES = [
  "FACTS_NAME_REQUIRED",
  "LOGFRAME_CYCLE",
  "LOGFRAME_PARENT_UNKNOWN",
  "LOGFRAME_DUPLICATE_CODE",
  "INDICATOR_DUPLICATE_CODE",
  "INDICATOR_LOGFRAME_UNKNOWN",
  "END_BEFORE_START",
  "PERIOD_OUTSIDE_DATES",
  "ACTIVITY_OUTSIDE_DATES",
  "CURRENCY_NOT_STATED",
  "LOGFRAME_SEVERAL_GOALS",
  "LOGFRAME_LEVEL_MISSING",
  "INDICATORS_NOT_PLACED",
  "ACTIVITIES_NOT_PLACED",
  "FACTS_DATES_FROM_PLAN",
  "BUDGET_TOTAL_MISMATCH",
  "COUNTRY_NOT_RECOGNISED",
  "FACTS_READINGS_DIFFER",
] as const;
export type SetupProblemCode = (typeof SETUP_PROBLEM_CODES)[number];

const SourceRefSchema = z.object({
  documentId: z.string().min(1).max(64),
  block: z.number().int().min(0),
  page: z.number().int().min(1).optional(),
});

/** One proposed value: what the document says, where it says it, how surely, and what the person decided. */
const proposedOf = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    sourceQuote: z.string().max(1000).nullable(),
    sourceRef: SourceRefSchema.nullable(),
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
    status: z.enum(["PROPOSED", "ACCEPTED", "REJECTED", "EDITED"]),
    alternatives: z.array(z.object({ value, sourceQuote: z.string().max(1000), sourceRef: SourceRefSchema.nullable() })).max(3).optional(),
  });

const ProposedString = proposedOf(z.string().max(2000));
const ProposedStrings = proposedOf(z.array(z.string().max(200)).max(30));
const ProposedPlainDay = proposedOf(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));
const ProposedNumber = proposedOf(z.number().min(-1e12).max(1e12));

export const ProposedFactsSchema = z.object({
  name: ProposedString,
  code: ProposedString,
  donor: ProposedString,
  countries: ProposedStrings,
  sectors: ProposedStrings,
  startDate: ProposedPlainDay,
  endDate: ProposedPlainDay,
  currency: ProposedString,
  summary: ProposedString,
});
export type ProposedFactsDto = z.infer<typeof ProposedFactsSchema>;

const LogframeNodeDefSchema = z.object({
  level: z.enum(["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"]),
  code: z.string().max(40).nullable(),
  title: z.string().max(300).nullable(),
  description: z.string().max(2000).nullable(),
  parentCode: z.string().max(40).nullable(),
  codeSource: z.enum(["DOCUMENT", "GENERATED"]).optional(),
});

const IndicatorDefSchema = z.object({
  code: z.string().max(40).nullable(),
  title: z.string().max(300).nullable(),
  logframeCode: z.string().max(40).nullable(),
  type: z.enum(["NUMBER", "PERCENTAGE", "RATIO", "CURRENCY"]).nullable(),
  unit: z.string().max(60).nullable(),
  baseline: z.string().max(100).nullable(),
  target: z.string().max(100).nullable(),
  targetSchedule: z.string().max(400).nullable(),
  frequency: z.string().max(120).nullable(),
  direction: z.string().max(60).nullable(),
  disaggregation: z.array(z.string().max(40)).max(10).nullable(),
  meansOfVerification: z.string().max(300).nullable(),
  codeSource: z.enum(["DOCUMENT", "GENERATED"]).optional(),
  linkSource: z.enum(["DOCUMENT", "SUGGESTED", "PERSON"]).optional(),
});

const PeriodDefSchema = z.object({
  type: z.string().max(40).nullable(),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

const PlannedActivityDefSchema = z.object({
  title: z.string().max(300).nullable(),
  logframeCode: z.string().max(40).nullable(),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  location: z.string().max(200).nullable(),
  lead: z.string().max(200).nullable(),
  group: z.string().max(300).nullable().optional(),
  planCode: z.string().max(40).nullable().optional(),
  key: z.string().max(80).optional(),
  linkSource: z.enum(["DOCUMENT", "SUGGESTED", "PERSON"]).optional(),
});

const PlaceDefSchema = z.object({
  name: z.string().max(200).nullable(),
  adminLevel: z.number().int().min(0).max(4).nullable(),
  parentName: z.string().max(200).nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  recognised: z.object({ name: z.string().max(300), within: z.string().max(600), country: z.string().max(200).nullable(), source: z.string().max(60) }).optional(),
  code: z.string().max(40).nullable().optional(),
  mapRef: z.string().max(200).nullable().optional(),
  viaChildren: z.boolean().optional(),
});

const FundingDefSchema = z.object({
  sourceName: z.string().max(200).nullable(),
  amount: z.string().max(100).nullable(),
  currency: z.string().max(10).nullable(),
});

const BudgetLineDefSchema = z.object({
  category: z.string().max(200).nullable(),
  amount: z.string().max(100).nullable(),
  currency: z.string().max(10).nullable(),
  logframeCode: z.string().max(40).nullable(),
  linkSource: z.enum(["DOCUMENT", "SUGGESTED", "PERSON"]).optional(),
  kind: z.enum(["LINE", "DETAIL", "TOTAL"]).optional(),
  ref: z.string().max(40).nullable().optional(),
  key: z.string().max(80).optional(),
});

const RiskDefSchema = z.object({
  kind: z.string().max(40).nullable(),
  title: z.string().max(300).nullable(),
  seriousness: z.string().max(40).nullable(),
  mitigation: z.string().max(1000).nullable(),
});

export const SETUP_DOCUMENT_KINDS = ["PROPOSAL", "LOGFRAME_MATRIX", "WORK_PLAN_GANTT", "BUDGET", "INDICATOR_TABLE", "OTHER"] as const;
export const SetupDocumentKindSchema = z.enum(SETUP_DOCUMENT_KINDS);

const SetupSourceInfoSchema = z.object({
  documentId: z.string().max(64),
  name: z.string().max(300),
  sheets: z.array(z.object({ title: z.string().max(200).nullable(), kind: SetupDocumentKindSchema })).max(60),
  override: SetupDocumentKindSchema.optional(),
  feeds: z.array(SetupAreaKeySchema).max(8).optional(),
});

/** A person's choice of what a document is; null puts the reading back. */
export const SetSetupDocumentKindSchema = z.object({ kind: SetupDocumentKindSchema.nullable() });
export type SetSetupDocumentKindInput = z.infer<typeof SetSetupDocumentKindSchema>;

export const ProjectSetupProposalSchema = z.object({
  sources: z.array(SetupSourceInfoSchema).max(10).optional(),
  sectionFindings: z.array(z.object({ area: SetupAreaKeySchema, state: z.enum(["FOUND", "PARTLY_EMPTY", "EMPTY", "NOT_IN_DOCUMENTS"]), emptyHeadings: z.array(z.string().max(300)).max(60) })).max(8).optional(),
  facts: ProposedFactsSchema,
  logframe: z.array(proposedOf(LogframeNodeDefSchema)).max(300),
  indicators: z.array(proposedOf(IndicatorDefSchema)).max(300),
  periods: z.array(proposedOf(PeriodDefSchema)).max(200),
  plan: z.array(proposedOf(PlannedActivityDefSchema)).max(400),
  places: z.array(proposedOf(PlaceDefSchema)).max(400),
  funding: z.array(proposedOf(FundingDefSchema)).max(100),
  budget: z.array(proposedOf(BudgetLineDefSchema)).max(600),
  risks: z.array(proposedOf(RiskDefSchema)).max(100),
});
export type ProjectSetupProposalDto = z.infer<typeof ProjectSetupProposalSchema>;

export const SetupProblemSchema = z.object({
  code: z.enum(SETUP_PROBLEM_CODES),
  path: z.string().max(120),
  severity: z.enum(["HARD", "SOFT"]),
  message: z.string().max(400),
  params: z.record(z.union([z.string().max(200), z.number()])).optional(),
});
export type SetupProblemDto = z.infer<typeof SetupProblemSchema>;

const ITEM_PATH = /^[a-z][a-zA-Z0-9_]{0,39}\.[a-zA-Z0-9_]{1,40}$/;
const ITEM_PATH_MESSAGE = "An item path names the area's field and the item (facts.name, logframe.0).";

/** One review edit: which area, which item, what to do with it. ACCEPT_MANY accepts a list of items in one save ("Accept all"); LINK places an item under the result whose code is `value` (null = none); CHOOSE takes alternative number `value`; MOVE gives a result `{ level, parentCode }`; ADD_INDICATOR adds the indicator in `value` (path "indicators.new"). */
export const EditSetupProposalSchema = z.object({
  area: SetupAreaKeySchema,
  path: z.string().regex(ITEM_PATH, ITEM_PATH_MESSAGE).optional(),
  paths: z.array(z.string().regex(ITEM_PATH, ITEM_PATH_MESSAGE)).min(1).max(500).optional(),
  op: z.enum(["ACCEPT", "REJECT", "EDIT", "FILL", "ACCEPT_MANY", "LINK", "CHOOSE", "MOVE", "ADD_INDICATOR"]),
  value: z.unknown().optional(),
  /** The `updatedAt` the person was looking at; when someone else has saved since, the edit is refused. */
  expectedUpdatedAt: z.string().max(40).optional(),
}).superRefine((v, ctx) => {
  if (v.op === "ACCEPT_MANY" ? !v.paths : !v.path) ctx.addIssue({ code: z.ZodIssueCode.custom, message: v.op === "ACCEPT_MANY" ? "List the items to accept." : "Name the item.", path: [v.op === "ACCEPT_MANY" ? "paths" : "path"] });
});
export type EditSetupProposalInput = z.infer<typeof EditSetupProposalSchema>;

export const RerunSetupAreaSchema = z.object({ area: SetupAreaKeySchema });
export type RerunSetupAreaInput = z.infer<typeof RerunSetupAreaSchema>;

/** Pasted text as a source (the upload path is multipart); the same 2 MB text cap the parsers enforce. */
export const StartSetupTextSchema = z.object({ fileName: z.string().max(200).optional(), text: z.string().min(1).max(2_000_000) });
export type StartSetupTextInput = z.infer<typeof StartSetupTextSchema>;

/** Which areas to preview or apply; omitted = every area. */
export const SetupAreaSelectionSchema = z.object({ areas: z.array(SetupAreaKeySchema).max(SETUP_AREA_KEYS.length).optional() });
export type SetupAreaSelectionInput = z.infer<typeof SetupAreaSelectionSchema>;

/** Apply: the areas, plus the person's completed project form (validated with the ordinary create-project schema). */
export const ApplySetupProposalSchema = SetupAreaSelectionSchema.extend({ project: CreateProjectSchema });
export type ApplySetupProposalInput = z.infer<typeof ApplySetupProposalSchema>;

export const SetupAssistSettingsSchema = z.object({ enabled: z.boolean() });
export type SetupAssistSettingsInput = z.infer<typeof SetupAssistSettingsSchema>;

/** One readable piece of the uploaded document; stored server-side, never sent to the web. */
export const SourceBlockSchema = z.object({
  documentId: z.string().min(1).max(64),
  index: z.number().int().min(0),
  page: z.number().int().min(1).optional(),
  text: z.string().max(20000),
});
export type SourceBlockDto = z.infer<typeof SourceBlockSchema>;

/** The organisation's default pack for a sector, as the Settings screen sends it. The domain's `checkPackInput` is the real judge. */
export const SetupPackSchema = z.object({
  sector: z.string().max(40).nullable().optional(),
  label: z.string().max(200),
  cadence: z.string().max(20).nullable().optional(),
  reportRules: z.array(z.object({ reportType: z.string().max(40), template: z.string().max(100).optional(), dueDaysAfterEnd: z.number() })).max(12).optional(),
  reviewMode: z.string().max(10).nullable().optional(),
  windowRule: z.object({ opensDaysBefore: z.number(), closesDaysAfter: z.number() }).nullable().optional(),
  risks: z.array(z.object({ kind: z.string().max(20).optional(), title: z.string().max(400), seriousness: z.string().max(10), mitigation: z.string().max(1000).optional() })).max(30).optional(),
  dashboardTemplate: z.string().max(100).nullable().optional(),
});
export type SetupPackInput = z.infer<typeof SetupPackSchema>;
