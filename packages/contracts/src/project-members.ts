import { z } from "zod";
import { RoleSchema } from "./identity.js";

export const ProjectMemberRoleSchema = RoleSchema;

export const AssignProjectMemberSchema = z.object({
  userId: z.string().min(1),
  role: ProjectMemberRoleSchema,
});
export type AssignProjectMemberInput = z.infer<typeof AssignProjectMemberSchema>;

export const UpdateProjectMemberSchema = z.object({
  role: ProjectMemberRoleSchema,
});
export type UpdateProjectMemberInput = z.infer<typeof UpdateProjectMemberSchema>;

export const BulkResolveChecklistSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1),
  decision: z.enum(["RESOLVE", "ACCEPT_RISK", "NOT_APPLICABLE", "START"]),
  notes: z.string().max(2000).optional(),
});
export type BulkResolveChecklistInput = z.infer<typeof BulkResolveChecklistSchema>;

export const RewriteSectionSchema = z.object({
  instructions: z.string().max(1000).optional(),
  mode: z.enum(["REWRITE", "SHORTEN"]).default("REWRITE"),
  audience: z.enum(["DONOR", "INTERNAL", "GENERAL"]).default("DONOR"),
  /**
   * Report Editor B10 — rewrite only this character range of the section's
   * stored markdown (`from` inclusive, `to` exclusive).
   */
  selection: z
    .object({ from: z.number().int().nonnegative(), to: z.number().int().positive() })
    .refine((s) => s.to > s.from, { message: "Selection end must be after its start" })
    .optional(),
  /** Return the suggestion without saving it (requires `selection`). */
  preview: z.boolean().optional(),
}).refine((input) => !input.preview || input.selection !== undefined, {
  message: "A preview rewrite needs a selection",
  path: ["preview"],
});
export type RewriteSectionInput = z.infer<typeof RewriteSectionSchema>;
