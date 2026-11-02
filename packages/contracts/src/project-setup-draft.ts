import { z } from "zod";

/**
 * Project Creation Wizard (Phase 38) wire shapes. The rules live in the domain (`contexts/project-setup/pcw`); these schemas
 * re-check a slide's edit at the edge. `SETUP_OPERATION_KINDS` mirrors the domain's `DRAFT_OPERATIONS` keys and is pinned by
 * `test/architecture-boundaries.test.mjs`.
 */
const text = (max: number) => z.string().trim().max(max);
const key = z.string().trim().min(1).max(64);

export const StartBlankSetupSchema = z.object({
  donor: text(200).optional(),
  sector: text(40).optional(),
  country: text(100).optional(),
});
export type StartBlankSetupInput = z.infer<typeof StartBlankSetupSchema>;

const PersonSchema = z.object({
  key,
  name: text(120).min(1),
  email: text(200).nullable(),
  role: text(40).min(1),
  external: z.boolean(),
  invite: z.enum(["NOW", "LATER"]),
});

const WindowRuleSchema = z.object({ opensDaysBefore: z.number().int().min(0).max(365), closesDaysAfter: z.number().int().min(0).max(365) });

const ReportRuleSchema = z.object({
  reportType: text(40).min(1),
  template: text(80).nullable(),
  dueDaysAfterEnd: z.number().int().min(0).max(365).nullable(),
});

export const SetupOperationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("SET_START"), patch: z.object({ donor: text(200), sector: text(40), country: text(100), packId: text(80) }).partial().strict() }),
  z.object({ kind: z.literal("ADD_PERSON"), person: PersonSchema }),
  z.object({ kind: z.literal("UPDATE_PERSON"), key, patch: PersonSchema.omit({ key: true }).partial().strict() }),
  z.object({ kind: z.literal("REMOVE_PERSON"), key }),
  z.object({
    kind: z.literal("SET_INDICATOR_SETUP"), code: text(80).min(1),
    patch: z.object({ ownerKey: key, method: z.enum(["FORM", "CONNECTOR", "MANUAL", "CALCULATED"]), direction: z.enum(["HIGHER", "LOWER"]), directionConfirmed: z.boolean(), baselineNone: z.boolean() }).partial().strict(),
  }),
  z.object({
    kind: z.literal("SET_PLAN_SETUP"), planKey: text(300).min(1),
    patch: z.object({
      placeNames: z.array(text(200)).max(100), projectWide: z.boolean(), indicatorCodes: z.array(text(80)).max(100),
      leadKey: key, requiredFiles: z.array(text(120)).max(50), recordsParticipants: z.boolean(),
    }).partial().strict(),
  }),
  z.object({ kind: z.literal("SET_PLACES_SETUP"), patch: z.object({ projectArea: text(200).nullable(), boundaryLevel: z.number().int().min(0).max(4).nullable() }).partial().strict() }),
  z.object({
    kind: z.literal("SET_COLLECTION"),
    patch: z.object({ reviewMode: z.enum(["SIMPLE", "FULL"]), windowRule: WindowRuleSchema }).partial().strict(),
  }),
  z.object({
    kind: z.literal("SET_SCHEDULE"),
    patch: z.object({ cadence: text(40), rules: z.array(ReportRuleSchema).max(20), reminders: z.boolean() }).partial().strict(),
  }),
  z.object({
    kind: z.literal("SET_FINANCE"),
    patch: z.object({
      reportingCurrency: text(3),
      budgetPlan: z.record(text(300), text(300)), differenceAcknowledged: z.boolean(),
    }).partial().strict(),
  }),
  z.object({ kind: z.literal("CONFIRM_CODES"), codes: z.array(text(80)).max(500) }),
  z.object({ kind: z.literal("ANSWER_NOT_USED"), requirement: text(80).min(1), reason: text(500).optional() }),
  z.object({ kind: z.literal("REOPEN_REQUIREMENT"), requirement: text(80).min(1) }),
  z.object({ kind: z.literal("REJECT_SUGGESTION"), id: text(300).min(1) }),
  z.object({ kind: z.literal("ACCEPT_METHOD_SUGGESTIONS"), ids: z.array(text(300).min(1)).min(1).max(500) }),
  z.object({ kind: z.literal("ACCEPT_BUDGET_SUGGESTIONS"), ids: z.array(text(300).min(1)).min(1).max(500) }),
  z.object({ kind: z.literal("ACCEPT_SUGGESTIONS"), ids: z.array(text(300).min(1)).min(1).max(500) }),
  z.object({ kind: z.literal("SET_DASHBOARD"), templateKey: text(80).min(1).nullable() }),
]);
export type SetupOperationInput = z.infer<typeof SetupOperationSchema>;

/** The kinds of draft edit; mirrors the domain's `DRAFT_OPERATIONS` keys. */
export const SETUP_OPERATION_KINDS = [
  "SET_START", "ADD_PERSON", "UPDATE_PERSON", "REMOVE_PERSON", "SET_INDICATOR_SETUP", "SET_PLAN_SETUP", "SET_PLACES_SETUP", "SET_COLLECTION",
  "SET_SCHEDULE", "SET_FINANCE", "CONFIRM_CODES", "ANSWER_NOT_USED", "REOPEN_REQUIREMENT", "REJECT_SUGGESTION", "ACCEPT_SUGGESTIONS", "ACCEPT_METHOD_SUGGESTIONS", "ACCEPT_BUDGET_SUGGESTIONS", "SET_DASHBOARD",
] as const;

/** Edits to the results framework and its indicators (they change the proposal, not the decisions). */
const Level = z.enum(["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"]);
export const SetupResultOperationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ADD_NODE"), level: Level, title: text(300).min(1), parentCode: text(40).nullable().optional() }),
  z.object({
    kind: z.literal("ADD_INDICATOR"),
    value: z.object({
      title: text(300).min(1), logframeCode: text(40).nullable().optional(), type: z.enum(["NUMBER", "PERCENTAGE", "RATIO", "CURRENCY"]).nullable().optional(),
      unit: text(60).nullable().optional(), baseline: text(100).nullable().optional(), target: text(100).nullable().optional(), frequency: text(120).nullable().optional(),
    }),
  }),
  z.object({
    kind: z.literal("EDIT_INDICATOR"), path: text(40).regex(/^indicators\.\d+$/),
    patch: z.object({
      title: text(300).min(1), type: z.enum(["NUMBER", "PERCENTAGE", "RATIO", "CURRENCY"]).nullable(), unit: text(60).nullable(), baseline: text(100).nullable(),
      target: text(100).nullable(), frequency: text(120).nullable(), logframeCode: text(40).nullable(), disaggregation: z.array(text(60)).max(20).nullable(),
    }).partial().strict(),
  }),
  z.object({ kind: z.literal("EDIT_NODE_TITLE"), path: text(40).regex(/^logframe\.\d+$/), title: text(300).min(1) }),
  z.object({ kind: z.literal("BULK_INDICATORS"), frequency: text(120).optional(), disaggregation: z.array(text(60)).max(20).optional(), level: Level.optional() }),
]);
export type SetupResultOperationInput = z.infer<typeof SetupResultOperationSchema>;
export const SETUP_RESULT_OPERATION_KINDS = ["ADD_NODE", "ADD_INDICATOR", "EDIT_INDICATOR", "EDIT_NODE_TITLE", "BULK_INDICATORS"] as const;

/** Edits to the places list (they change the proposal). */
export const SetupPlaceOperationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ADD_PLACE"), name: text(200).min(1), adminLevel: z.number().int().min(0).max(4).nullable().optional(), parentName: text(200).nullable().optional() }),
  z.object({
    kind: z.literal("EDIT_PLACE"), path: text(40).regex(/^places\.\d+$/),
    patch: z.object({ name: text(200).min(1), adminLevel: z.number().int().min(0).max(4).nullable(), parentName: text(200).nullable() }).partial().strict(),
  }),
]);
export type SetupPlaceOperationInput = z.infer<typeof SetupPlaceOperationSchema>;
export const SETUP_PLACE_OPERATION_KINDS = ["ADD_PLACE", "EDIT_PLACE"] as const;

/** Edits to the planned activities (they change the proposal). */
const Day = text(10).nullable();
export const SetupPlanOperationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ADD_PLAN"), title: text(300).min(1), logframeCode: text(40).nullable().optional(), start: Day.optional(), end: Day.optional(), location: text(200).nullable().optional() }),
  z.object({
    kind: z.literal("EDIT_PLAN"), path: text(40).regex(/^plan\.\d+$/),
    patch: z.object({ title: text(300).min(1), logframeCode: text(40).nullable(), start: Day, end: Day, location: text(200).nullable() }).partial().strict(),
  }),
]);
export type SetupPlanOperationInput = z.infer<typeof SetupPlanOperationSchema>;
export const SETUP_PLAN_OPERATION_KINDS = ["ADD_PLAN", "EDIT_PLAN"] as const;

/** Edits to funding and budget lines (they change the proposal). Amounts are text so "1,250.50" can be read the way the person means it. */
const Amount = text(40);
export const SetupFinanceOperationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ADD_FUNDING"), sourceName: text(200).min(1), amount: Amount.min(1), currency: text(10).min(1) }),
  z.object({
    kind: z.literal("EDIT_FUNDING"), path: text(40).regex(/^funding\.\d+$/),
    patch: z.object({ sourceName: text(200).min(1), amount: Amount.min(1), currency: text(10).min(1) }).partial().strict(),
  }),
  z.object({ kind: z.literal("ADD_BUDGET"), category: text(200).min(1), amount: Amount.min(1), currency: text(10).min(1), ref: text(40).nullable().optional(), budgetKind: z.enum(["LINE", "DETAIL"]).optional() }),
  z.object({
    kind: z.literal("EDIT_BUDGET"), path: text(40).regex(/^budget\.\d+$/),
    patch: z.object({ category: text(200).min(1), amount: Amount.min(1), currency: text(10).min(1), ref: text(40).nullable(), kind: z.enum(["LINE", "DETAIL"]) }).partial().strict(),
  }),
]);
export type SetupFinanceOperationInput = z.infer<typeof SetupFinanceOperationSchema>;
export const SETUP_FINANCE_OPERATION_KINDS = ["ADD_FUNDING", "EDIT_FUNDING", "ADD_BUDGET", "EDIT_BUDGET"] as const;

/** Edits to the risks and assumptions list (they change the proposal). */
export const SetupRiskOperationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ADD_RISK"), riskKind: text(20).min(1), title: text(200).min(1), seriousness: text(10).nullable().optional(), mitigation: text(1000).nullable().optional() }),
  z.object({
    kind: z.literal("EDIT_RISK"), path: text(40).regex(/^risks\.\d+$/),
    patch: z.object({ kind: text(20).min(1), title: text(200).min(1), seriousness: text(10).nullable(), mitigation: text(1000).nullable() }).partial().strict(),
  }),
]);
export type SetupRiskOperationInput = z.infer<typeof SetupRiskOperationSchema>;
export const SETUP_RISK_OPERATION_KINDS = ["ADD_RISK", "EDIT_RISK"] as const;
