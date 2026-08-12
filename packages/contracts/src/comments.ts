import { z } from "zod";

export const CreateCommentSchema = z.object({
  entityType: z.enum(["report_section", "evidence", "indicator_update", "checklist_item", "activity_update"]),
  entityId: z.string().min(1),
  commentText: z.string().min(1).max(5000),
  mentionedUserId: z.string().optional(),
});
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;
