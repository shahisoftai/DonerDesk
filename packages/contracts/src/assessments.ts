import { z } from "zod";

/** Assessments and long surveys (Phase 62): drafts, facility assignments, kits, reading a tool from a file, corrective actions. */

export const SaveDraftSchema = z.object({
  /** The facility the draft is about; absent for a form with no subject. */
  placeId: z.string().min(1).max(64).optional(),
  answers: z.record(z.unknown()),
  how: z.record(z.string().max(40), z.string().max(20)).optional(),
  /** The version this save started from (the draft's `updatedAt`); absent for the first save. */
  expectedUpdatedAt: z.string().max(40).optional(),
  startedAt: z.string().datetime().optional(),
});
export type SaveDraftInput = z.infer<typeof SaveDraftSchema>;

export const AssignFacilitiesSchema = z.object({
  assignments: z.array(z.object({ placeId: z.string().min(1).max(64), assigneeId: z.string().min(1).max(64), dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })).min(1).max(300),
});
export type AssignFacilitiesInput = z.infer<typeof AssignFacilitiesSchema>;

export const MoveAssignmentSchema = z.object({ status: z.enum(["TO_DO", "IN_PROGRESS", "DONE", "NOT_VISITED"]), reason: z.string().trim().max(500).optional() });
export type MoveAssignmentInput = z.infer<typeof MoveAssignmentSchema>;

export const ApplyKitSchema = z.object({ kitId: z.string().min(1).max(80), projectId: z.string().min(1), name: z.string().trim().min(1).max(200).optional() });
export type ApplyKitInput = z.infer<typeof ApplyKitSchema>;

export const CorrectiveActionSchema = z.object({
  /** The item that scored low: its path in the answers, and a name for it. */
  path: z.string().min(1).max(200),
  label: z.string().min(1).max(300),
  kind: z.enum(["TASK", "RISK"]),
  /** Who is asked (a task); due day (a task). */
  assigneeId: z.string().min(1).max(64).optional(),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type CorrectiveActionInput = z.infer<typeof CorrectiveActionSchema>;
