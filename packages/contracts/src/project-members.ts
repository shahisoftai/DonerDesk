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
});
export type RewriteSectionInput = z.infer<typeof RewriteSectionSchema>;
