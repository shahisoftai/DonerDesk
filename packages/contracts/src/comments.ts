import { z } from "zod";

export const CreateCommentSchema = z.object({
  entityType: z.enum(["report_section", "evidence", "indicator_update", "checklist_item", "activity_update", "indicator", "planned_activity", "project_risk", "report_claim", "infographic"]),
  entityId: z.string().min(1),
  commentText: z.string().min(1).max(5000),
  mentionedUserId: z.string().optional(),
  /** The first comment of the thread this one replies to; threads are one level deep. */
  parentId: z.string().optional(),
});
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;
