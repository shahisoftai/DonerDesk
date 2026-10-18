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
  description: z.string().max(5000).optional(),
  ...targets,
});
export type CreatePlannedActivityInput = z.infer<typeof CreatePlannedActivitySchema>;

/** `null` clears a field; an absent key leaves it as it is. */
export const UpdatePlannedActivitySchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  location: z.string().max(200).nullable().optional(),
  logframeActivityId: z.string().min(1).nullable().optional(),
  targetParticipants: z.number().int().positive().nullable().optional(),
  targetCount: z.number().int().positive().nullable().optional(),
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
});
export type ChangePlanStatusInput = z.infer<typeof ChangePlanStatusSchema>;

export const AssignPlannedActivitySchema = z.object({
  ownerUserId: z.string().min(1).nullable(),
  supportUserIds: z.array(z.string().min(1)).max(10).default([]),
  reason: z.string().max(1000).optional(),
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
