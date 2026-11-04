import { z } from "zod";
import type { BudgetLineDef, FundingDef, RiskDef, IndicatorDef, LogframeNodeDef, PlaceDef, PlannedActivityDef, RequirementCode, SetupExtras, SlideKey } from "@donordesk/domain";

/** The wizard's draft as the API answers it (Phase 38). The decisions are the API's own typed shape, trusted as it sends them. */
const Result = z.object({
  key: z.string(),
  slide: z.custom<SlideKey>((v) => typeof v === "string"),
  status: z.enum(["OPEN", "MET", "NOT_USED"]),
  code: z.custom<RequirementCode>((v) => typeof v === "string").optional(),
  params: z.record(z.union([z.string(), z.number()])).optional(),
  itemKey: z.string().optional(),
});

const item = <T>() => z.object({
  path: z.string(),
  status: z.enum(["PROPOSED", "ACCEPTED", "REJECTED", "EDITED"]),
  origin: z.enum(["DOCUMENT", "SUGGESTED", "USER"]),
  quote: z.string().nullable(),
  source: z.object({ documentId: z.string(), block: z.number() }).nullable().optional(),
  value: z.custom<T>((v) => typeof v === "object" && v !== null),
});

export const SetupDraftViewSchema = z.object({
  id: z.string(),
  status: z.enum(["EXTRACTING", "READY", "APPLYING", "APPLIED", "PARTIAL", "FAILED", "DISCARDED"]),
  updatedAt: z.string(),
  appliedProjectId: z.string().nullable(),
  facts: z.object({ name: z.string().nullable(), code: z.string().nullable(), startDate: z.string().nullable(), endDate: z.string().nullable(), currency: z.string().nullable(), summary: z.string().nullable() }),
  logframe: z.array(item<LogframeNodeDef>()),
  indicators: z.array(item<IndicatorDef>()),
  places: z.array(item<PlaceDef>()),
  plan: z.array(item<PlannedActivityDef>().extend({ planKey: z.string() })),
  suggestions: z.array(z.object({ id: z.string(), kind: z.enum(["INDICATOR", "PLACE", "LEAD"]), planKey: z.string(), value: z.string(), reason: z.string() })),
  methodSuggestions: z.array(z.object({ id: z.string(), indicatorCode: z.string(), method: z.enum(["FORM", "CONNECTOR", "MANUAL", "CALCULATED"]), reason: z.string() })),
  timeline: z.object({ periods: z.array(z.object({ reportType: z.string(), startDate: z.string(), endDate: z.string(), dueDate: z.string().nullable(), closing: z.boolean() })), note: z.string().optional() }),
  funding: z.array(item<FundingDef>()),
  budget: z.array(item<BudgetLineDef>().extend({ budgetKey: z.string() })),
  budgetSuggestions: z.array(z.object({ id: z.string(), budgetKey: z.string(), target: z.string(), reason: z.string() })),
  financeSummary: z.object({
    funding: z.array(z.object({ currency: z.string(), total: z.number() })),
    budget: z.array(z.object({ currency: z.string(), total: z.number() })),
    differences: z.array(z.object({ currency: z.string(), funding: z.number(), budget: z.number() })),
    statedTotalMismatch: z.boolean(),
    unreadable: z.number(),
  }),
  risks: z.array(item<RiskDef>()),
  summary: z.object({
    results: z.number(), indicators: z.number(), places: z.number(), plannedActivities: z.number(), budgetLines: z.number(), fundingSources: z.number(),
    risks: z.number(), assumptions: z.number(), people: z.number(), invitedAtLaunch: z.number(), invitedLater: z.number(),
    fromDocuments: z.object({ accepted: z.number(), leftOut: z.number() }),
  }),
  launch: z.object({ ok: z.boolean(), blockers: z.array(z.discriminatedUnion("kind", [z.object({ kind: z.literal("OPEN_REQUIREMENTS"), count: z.number() }), z.object({ kind: z.literal("SIGN_OFF_MISSING") }), z.object({ kind: z.literal("SIGN_OFF_STALE") })])) }),
  dashboardOptions: z.array(z.object({ id: z.string(), title: z.string(), sector: z.string() })),
  coverage: z.object({
    activities: z.object({ covered: z.number(), total: z.number() }),
    plans: z.object({ complete: z.number(), total: z.number() }),
    indicators: z.object({ fed: z.number(), total: z.number() }),
  }),
  sources: z.array(z.object({
    documentId: z.string(), name: z.string(),
    sheets: z.array(z.object({ title: z.string().nullable(), kind: z.string() })),
    override: z.string().optional(), feeds: z.array(z.string()).optional(),
  })).default([]),
  sectionFindings: z.array(z.object({ area: z.string(), state: z.enum(["FOUND", "PARTLY_EMPTY", "EMPTY", "NOT_IN_DOCUMENTS"]), emptyHeadings: z.array(z.string()) })).default([]),
  leftOut: z.array(z.object({ area: z.string(), total: z.number(), items: z.array(z.object({ field: z.string(), text: z.string(), reason: z.enum(["QUOTE_NOT_FOUND", "FIGURE_NOT_IN_QUOTE", "DATE_NOT_IN_QUOTE", "TEMPLATE_PLACEHOLDER", "VALUE_NOT_IN_QUOTE", "UNREADABLE"]) })) })).default([]),
  areaRuns: z.record(z.enum(["RUNNING", "FAILED", "FINISHED"])).default({}),
  extras: z.custom<SetupExtras>((v) => typeof v === "object" && v !== null),
  results: z.array(Result),
  inbox: z.array(Result),
  progress: z.array(z.object({ slide: z.custom<SlideKey>((v) => typeof v === "string"), total: z.number(), open: z.number(), complete: z.boolean() })),
});
export type SetupDraftView = z.infer<typeof SetupDraftViewSchema>;
export type SetupResultView = z.infer<typeof Result>;

export const SetupDraftStartedSchema = z.object({ proposalId: z.string() });
export const SetupPackAppliedSchema = z.object({ view: SetupDraftViewSchema, packLabel: z.string(), filled: z.array(z.string()) });
export type SetupPackApplied = z.infer<typeof SetupPackAppliedSchema>;
export type DraftItem<T> = SetupDraftView["logframe"][number] & { value: T };

export const LaunchReportSchema = z.object({
  projectId: z.string(),
  status: z.enum(["LAUNCHED", "PARTIAL"]),
  areas: z.array(z.object({ area: z.string(), status: z.enum(["APPLIED", "ALREADY_APPLIED", "FAILED", "NOT_RUN"]), created: z.number(), skipped: z.number(), notes: z.array(z.string()), error: z.string().optional() })),
  steps: z.array(z.object({ key: z.string(), label: z.string(), status: z.enum(["DONE", "ALREADY_DONE", "FAILED", "NOT_RUN"]), done: z.number(), notes: z.array(z.string()), error: z.string().optional() })),
  notWritten: z.array(z.string()),
});
export type LaunchReport = z.infer<typeof LaunchReportSchema>;
