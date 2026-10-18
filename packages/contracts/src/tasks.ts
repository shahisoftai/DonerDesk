import { z } from "zod";
import { PlainDateSchema } from "./workplan.js";

export const TaskKindSchema = z.enum(["RECORD_ACTIVITY", "PROVIDE_EVIDENCE", "ENTER_INDICATOR_VALUE", "REVIEW_RECORD", "OTHER"]);

/** A request. The kind comes from the button that was pressed; the dialog asks only who, by when, and an optional note. */
export const CreateTaskSchema = z.object({
  kind: TaskKindSchema,
  subjectType: z.enum(["plannedActivity", "activityUpdate", "indicator"]).optional(),
  subjectId: z.string().min(1).optional(),
  reportingPeriodId: z.string().min(1).optional(),
  assigneeId: z.string().min(1),
  /** Suggested by the server when absent. */
  dueDate: PlainDateSchema.optional(),
  note: z.string().max(2000).optional(),
  urgent: z.boolean().default(false),
  /** What is being asked; used only by a free-text request ("Ask someone…"). */
  title: z.string().trim().min(1).max(300).optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const CompleteTaskSchema = z.object({ note: z.string().max(2000).optional() });
export type CompleteTaskInput = z.infer<typeof CompleteTaskSchema>;

/** `userId: null` removes the lead. */
export const SetOwnerSchema = z.object({ userId: z.string().min(1).nullable() });
export type SetOwnerInput = z.infer<typeof SetOwnerSchema>;

export const ListAssignmentsQuerySchema = z.object({ userId: z.string().min(1).optional(), projectId: z.string().min(1).optional() });
export type ListAssignmentsQuery = z.infer<typeof ListAssignmentsQuerySchema>;
