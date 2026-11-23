import { z } from "zod";

/** What the assessment endpoints answer (Phase 62). Shapes mirror the application's DTOs; free parts pass through as the domain describes them. */
export const DraftSchema = z.object({
  id: z.string(), formId: z.string(), placeId: z.string().optional(), answers: z.record(z.unknown()), how: z.record(z.string()).optional(), startedAt: z.string(), updatedAt: z.string(),
});
export type DraftView = z.infer<typeof DraftSchema>;
export const DraftEnvelopeSchema = z.object({ draft: DraftSchema.nullable() });
export const MyDraftListSchema = z.object({ drafts: z.array(DraftSchema.extend({ expiresOn: z.string(), remind: z.boolean() })) });
export type MyDraftView = z.infer<typeof MyDraftListSchema>["drafts"][number];

const AssignmentStatus = z.enum(["TO_DO", "IN_PROGRESS", "DONE", "NOT_VISITED"]);
export const AssignmentSchema = z.object({
  id: z.string(), formId: z.string(), formName: z.string().optional(), projectId: z.string(), placeId: z.string(), placeName: z.string(), path: z.string(), assigneeId: z.string(),
  dueOn: z.string().optional(), status: AssignmentStatus, reason: z.string().optional(), recordId: z.string().optional(),
});
export type AssignmentView = z.infer<typeof AssignmentSchema>;
export const MyAssignmentsSchema = z.object({ assignments: z.array(AssignmentSchema) });
export const FormAssignmentsSchema = z.object({
  assignments: z.array(AssignmentSchema),
  coverage: z.array(z.object({ areaId: z.string(), area: z.string(), assigned: z.number(), started: z.number(), done: z.number(), notVisited: z.number(), toDo: z.number() })),
});
export type FormAssignmentsView = z.infer<typeof FormAssignmentsSchema>;
export const AssignResultSchema = z.object({ assigned: z.number(), skippedDone: z.number() });

export const PrefillSchema = z.object({ values: z.record(z.unknown()), carried: z.array(z.string()), fromVisit: z.number().optional(), fromDay: z.string().optional() });
export type PrefillView = z.infer<typeof PrefillSchema>;

export const ScoreSchema = z.object({
  overall: z.number().nullable(),
  sections: z.array(z.object({ key: z.string(), title: z.string(), percent: z.number().nullable(), earned: z.number(), possible: z.number(), answered: z.number(), unanswered: z.number(), notApplicable: z.number(), skipped: z.boolean().optional() })),
  band: z.object({ label: z.string(), tone: z.string() }).nullable(), bandWithheld: z.string().optional(),
  answered: z.number(), total: z.number(), answeredShare: z.number(), illustrative: z.boolean(),
  lowest: z.array(z.object({ section: z.string(), path: z.string(), label: z.string(), points: z.number(), possible: z.number() })),
});
export type ScoreView = z.infer<typeof ScoreSchema>;

export const ComparisonSchema = z.object({
  items: z.array(z.object({ section: z.string(), path: z.string(), label: z.string(), before: z.string().nullable(), after: z.string().nullable(), change: z.enum(["IMPROVED", "SAME", "WORSE", "NOT_COMPARABLE"]) })),
  sections: z.array(z.object({ key: z.string(), title: z.string(), before: z.number().nullable(), after: z.number().nullable(), delta: z.number().nullable() })),
  overall: z.object({ before: z.number().nullable(), after: z.number().nullable(), delta: z.number().nullable() }),
  counts: z.object({ IMPROVED: z.number(), SAME: z.number(), WORSE: z.number(), NOT_COMPARABLE: z.number() }),
  beforeVisit: z.number().optional(), afterVisit: z.number().optional(),
});
export type ComparisonView = z.infer<typeof ComparisonSchema>;

export const ActionResultSchema = z.object({ kind: z.enum(["TASK", "RISK"]), id: z.string() });

export const KitListSchema = z.object({
  kits: z.array(z.object({
    id: z.string(), name: z.string(), sector: z.string(), description: z.string(), source: z.string(), unreviewed: z.literal(true), notes: z.array(z.string()), fieldCount: z.number(),
    suggestedIndicators: z.array(z.object({ code: z.string(), name: z.string(), unit: z.string(), method: z.string(), plain: z.string() })),
  })),
});
export type KitView = z.infer<typeof KitListSchema>["kits"][number];
export const KitAppliedSchema = z.object({ id: z.string(), notes: z.array(z.string()), unreviewed: z.boolean(), suggestedIndicators: z.array(z.object({ code: z.string(), name: z.string(), unit: z.string(), method: z.string(), plain: z.string() })) });

export const ProposalSchema = z.object({
  fields: z.array(z.object({ quote: z.string(), field: z.object({ key: z.string(), label: z.string(), type: z.string() }).passthrough() })),
  sections: z.number(), unread: z.array(z.string()), problems: z.array(z.string()),
});
export type ProposalView = z.infer<typeof ProposalSchema>;
