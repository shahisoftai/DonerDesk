import { z } from "zod";

/** A plain calendar day, "2026-03-12". Plan dates are never instants. */
export const PlainDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date as YYYY-MM-DD");

export const PlanRepeatsSchema = z.object({
  every: z.enum(["WEEK", "MONTH"]),
  until: PlainDateSchema,
});

const targets = {
  targetParticipants: z.number().int().positive().optional(),
  targetCount: z.number().int().positive().optional(),
  effort: z.number().int().min(1).max(5).optional(),
};

export const CreatePlannedActivitySchema = z.object({
  title: z.string().trim().min(1).max(300),
  plannedStart: PlainDateSchema,
  plannedEnd: PlainDateSchema,
  repeats: PlanRepeatsSchema.optional(),
  ownerUserId: z.string().min(1).optional(),
  supportUserIds: z.array(z.string().min(1)).max(10).default([]),
  logframeActivityId: z.string().min(1).optional(),
  location: z.string().max(200).optional(),
  /** A hand-placed place when no gazetteer name matches; both together or neither (Phase 30.1). */
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  description: z.string().max(5000).optional(),
  /** Kinds of file that should prove the activity ("Files we will need"); suggested in the form, never required. */
  requiredFiles: z.array(z.string().min(1)).max(5).optional(),
  ...targets,
});
export type CreatePlannedActivityInput = z.infer<typeof CreatePlannedActivitySchema>;

/** `null` clears a field; an absent key leaves it as it is. */
export const UpdatePlannedActivitySchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  location: z.string().max(200).nullable().optional(),
  /** `null` clears a hand-placed place; both together or neither (Phase 30.1). */
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  logframeActivityId: z.string().min(1).nullable().optional(),
  targetParticipants: z.number().int().positive().nullable().optional(),
  targetCount: z.number().int().positive().nullable().optional(),
  effort: z.number().int().min(1).max(5).optional(),
  requiredFiles: z.array(z.string().min(1)).max(5).optional(),
  reason: z.string().max(1000).optional(),
});
export type UpdatePlannedActivityInput = z.infer<typeof UpdatePlannedActivitySchema>;

export const ReschedulePlannedActivitySchema = z.object({
  plannedStart: PlainDateSchema,
  plannedEnd: PlainDateSchema,
  scope: z.enum(["THIS", "SERIES_FROM_HERE"]).default("THIS"),
  reason: z.string().max(1000).optional(),
});
export type ReschedulePlannedActivityInput = z.infer<typeof ReschedulePlannedActivitySchema>;

export const ChangePlanStatusSchema = z.object({
  action: z.enum(["START", "COMPLETE", "REOPEN", "CANCEL", "RESTORE"]),
  reason: z.string().max(1000).optional(),
  /** The day the work finished, for COMPLETE recorded after the fact. Defaults to today; cannot be in the future. */
  completedOn: PlainDateSchema.optional(),
});
export type ChangePlanStatusInput = z.infer<typeof ChangePlanStatusSchema>;

export const AssignPlannedActivitySchema = z.object({
  ownerUserId: z.string().min(1).nullable(),
  supportUserIds: z.array(z.string().min(1)).max(10).default([]),
  reason: z.string().max(1000).optional(),
  /** "THIS" (default) or "SERIES_FROM_HERE": this activity and the later ones of its repeating series, still open. */
  scope: z.enum(["THIS", "SERIES_FROM_HERE"]).default("THIS"),
});
export type AssignPlannedActivityInput = z.infer<typeof AssignPlannedActivitySchema>;

export const StartPlanFromLogframeSchema = z.object({
  /** false = preview only (nothing saved); true = create the plan. */
  apply: z.boolean().default(false),
  rows: z
    .array(
      z.object({
        logframeActivityId: z.string().min(1),
        plannedStart: PlainDateSchema.optional(),
        plannedEnd: PlainDateSchema.optional(),
        monthly: z.boolean().default(false),
        ownerUserId: z.string().min(1).optional(),
      }),
    )
    .max(500)
    .optional(),
});
export type StartPlanFromLogframeInput = z.infer<typeof StartPlanFromLogframeSchema>;

export const ListWorkPlanQuerySchema = z.object({
  from: PlainDateSchema.optional(),
  to: PlainDateSchema.optional(),
  outputId: z.string().min(1).optional(),
  ownerId: z.string().min(1).optional(),
  status: z.enum(["PLANNED", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
});
export type ListWorkPlanQuery = z.infer<typeof ListWorkPlanQuerySchema>;

export const SetWorkPlanningVisibilitySchema = z.object({ show: z.boolean() });
export type SetWorkPlanningVisibilityInput = z.infer<typeof SetWorkPlanningVisibilitySchema>;

export const ImportWorkPlanSchema = z.object({
  /** false = preview (nothing saved); true = create the activities. */
  apply: z.boolean().default(true),
  text: z.string().min(1).max(2_000_000),
  sourceName: z.string().max(300).optional(),
});
export type ImportWorkPlanInput = z.infer<typeof ImportWorkPlanSchema>;

/** "B starts after A ends" (phase 28.1-A). Refused for a loop, a duplicate, a self link, or another project. */
export const AddPlanDependencySchema = z.object({
  predecessorId: z.string().min(1).max(64),
  successorId: z.string().min(1).max(64),
}).strict();
export type AddPlanDependencyInput = z.infer<typeof AddPlanDependencySchema>;

/** A custom field a project defines (phase 28.1-C): text, number, date, or one choice from a list. */
export const DefineProjectFieldSchema = z.object({
  label: z.string().trim().min(1).max(80),
  type: z.enum(["TEXT", "NUMBER", "DATE", "CHOICE"]),
  choices: z.array(z.string().max(100)).max(30).optional(),
}).strict();
export type DefineProjectFieldInput = z.infer<typeof DefineProjectFieldSchema>;

/** Values for a planned activity's fields. A `null` or empty value clears the stored one. */
export const SetPlanItemFieldsSchema = z.object({
  values: z.array(z.object({ fieldId: z.string().min(1).max(64), value: z.string().max(500).nullable() })).max(20),
}).strict();
export type SetPlanItemFieldsInput = z.infer<typeof SetPlanItemFieldsSchema>;

/** A budget line on a planned activity (phase 28.1-D). The amount is typed (e.g. "1200" or "12.50") and checked on the server. */
export const AddBudgetLineSchema = z.object({
  code: z.string().max(30),
  category: z.enum(["PERSONNEL", "TRAVEL", "SUPPLIES", "EQUIPMENT", "SERVICES", "OTHER"]),
  description: z.string().max(300).optional(),
  donorName: z.string().max(200).optional(),
  currency: z.string().max(3),
  amount: z.string().max(20),
}).strict();
export type AddBudgetLineInput = z.infer<typeof AddBudgetLineSchema>;

/** An expense booked against one budget line. */
export const AddBudgetExpenseSchema = z.object({
  date: PlainDateSchema,
  amount: z.string().max(20),
  description: z.string().max(300).optional(),
}).strict();
export type AddBudgetExpenseInput = z.infer<typeof AddBudgetExpenseSchema>;

/** Change many planned activities at once (phase 28.1-L). Without `apply` it only previews; nothing is saved until `apply` is true. */
export const BulkActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("SHIFT"), days: z.number().int().min(-365).max(365) }),
  z.object({ kind: z.literal("SET_LEAD"), leadUserId: z.string().min(1).nullable() }),
  z.object({ kind: z.literal("SET_STATUS"), status: z.enum(["START", "COMPLETE", "REOPEN", "CANCEL", "RESTORE"]) }),
]);

/** The steps a bulk change returned, sent back to put each activity as it was. */
export const UndoBulkPlanActionSchema = z.object({
  steps: z.array(z.object({ id: z.string().min(1).max(64), action: BulkActionSchema })).min(1).max(100),
}).strict();
export type UndoBulkPlanActionInput = z.infer<typeof UndoBulkPlanActionSchema>;

export const BulkPlanActionSchema = z.object({
  ids: z.array(z.string().min(1).max(64)).min(1).max(100),
  action: BulkActionSchema,
  reason: z.string().max(1000).optional(),
  apply: z.boolean().default(false),
}).strict();
export type BulkPlanActionInput = z.infer<typeof BulkPlanActionSchema>;

/** How many planned activities a person can lead in a week; null clears the limit (phase 28.1-J). */
export const SetCapacitySchema = z.object({ activitiesPerWeek: z.number().int().min(1).max(30).nullable() }).strict();
export type SetCapacityInput = z.infer<typeof SetCapacitySchema>;

/** Switch one automation rule on or off for a project (phase 28.1-K). */
export const SetAutomationRuleSchema = z.object({ enabled: z.boolean() }).strict();

/** A person a project reaches, by case code only (phase 28.1-G). No name, phone or ID is accepted. */
export const RegisterBeneficiarySchema = z.object({
  caseCode: z.string().max(30),
  sex: z.enum(["FEMALE", "MALE"]),
  ageGroup: z.enum(["UNDER_5", "AGE_5_17", "AGE_18_59", "AGE_60_PLUS"]),
  location: z.string().max(200).optional(),
  enrolledOn: PlainDateSchema,
  consentRecorded: z.literal(true, { errorMap: () => ({ message: "Record consent before saving this person" }) }),
}).strict();
export type RegisterBeneficiaryInput = z.infer<typeof RegisterBeneficiarySchema>;

/** A KoboToolbox or ODK export as text (CSV), one person per submission (phase 28.1-I). */
export const ImportSubmissionsSchema = z.object({ csv: z.string().min(1).max(2_000_000) }).strict();
export type ImportSubmissionsInput = z.infer<typeof ImportSubmissionsSchema>;

/** Which indicators a planned activity reports on. Their breakdowns become the fields of its progress log. */
export const SetPlanIndicatorsSchema = z.object({ indicatorIds: z.array(z.string().min(1).max(64)).max(30) }).strict();

/** One progress entry: a day or week (key = date), a month (key = YYYY-MM) or the activity end (key empty). Figures as typed; blank stays blank. */
export const SaveProgressSchema = z.object({
  kind: z.enum(["DAILY", "WEEKLY", "MONTHLY", "END"]),
  key: z.string().max(10),
  values: z.object({
    total: z.string().max(12),
    breakdowns: z.record(z.string().max(160), z.string().max(12)),
    sessions: z.string().max(12),
    unique: z.string().max(12),
  }),
  narrative: z.object({
    notes: z.string().max(2000), summary: z.string().max(2000), achievements: z.string().max(2000),
    challenges: z.string().max(2000), nextSteps: z.string().max(2000), lessons: z.string().max(2000),
  }).partial(),
  /** Set only when changing the entry already logged for this kind and range. */
  replaceId: z.string().min(1).max(64).optional(),
}).strict();
export type SaveProgressRequest = z.infer<typeof SaveProgressSchema>;

/** Mark a planned activity done in one step: the day it finished, how many people (optional), and a note (optional). */
export const CompletePlannedActivitySchema = z.object({
  finishedOn: PlainDateSchema,
  people: z.string().max(12).optional(),
  note: z.string().max(5000).optional(),
}).strict();
export type CompletePlannedActivityInput = z.infer<typeof CompletePlannedActivitySchema>;

/** The column for each import field, as the file names it (phase 28.1-I). Required fields must be set. */
export const SubmissionMappingSchema = z.object({
  case_code: z.string().min(1).max(200).optional(),
  sex: z.string().min(1).max(200).optional(),
  age_group: z.string().min(1).max(200).optional(),
  location: z.string().min(1).max(200).optional(),
  date: z.string().min(1).max(200).optional(),
  consent: z.string().min(1).max(200).optional(),
}).strict();
export const ImportSubmissionsWithMappingSchema = z.object({
  csv: z.string().min(1).max(2_000_000),
  mapping: SubmissionMappingSchema.optional(),
}).strict();

/** Add people to an activity by case code (pasted, separated by commas, spaces or new lines), or remove them by id. */
export const ChangeActivityPeopleSchema = z.object({
  addCaseCodes: z.string().max(20000).default(""),
  removeIds: z.array(z.string().min(1).max(64)).max(500).default([]),
}).strict();
export type ChangeActivityPeopleInput = z.infer<typeof ChangeActivityPeopleSchema>;

/** The numbers for one automation rule, by name. Each is checked against the rule's own range on the server. */
export const SetAutomationRuleSettingsSchema = z.object({ values: z.record(z.string().min(1).max(40), z.number()) }).strict();
export type SetAutomationRuleSettingsInput = z.infer<typeof SetAutomationRuleSettingsSchema>;

/** Days after a period ends that a project's indicator values are due. Checked again on the server (whole number, 0 to 60). */
export const SetEntryDueDaysSchema = z.object({ days: z.number() }).strict();
export type SetEntryDueDaysInput = z.infer<typeof SetEntryDueDaysSchema>;
