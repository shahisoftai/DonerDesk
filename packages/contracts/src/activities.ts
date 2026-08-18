import { z } from "zod";

export const CreateActivityUpdateSchema = z.object({
  projectId: z.string().min(1),
  reportingPeriodId: z.string().min(1),
  activityTitle: z.string().min(1).max(300),
  activityDate: z.string().datetime(),
  location: z.string().max(200).optional(),
  outputId: z.string().optional(),
  indicatorId: z.string().optional(),
  participantsTotal: z.number().int().nonnegative().optional(),
  participantsMale: z.number().int().nonnegative().optional(),
  participantsFemale: z.number().int().nonnegative().optional(),
  participantsChildren: z.number().int().nonnegative().optional(),
  participantsDisability: z.number().int().nonnegative().optional(),
  participantsOther: z.string().max(300).optional(),
  summary: z.string().min(1).max(10000),
  achievements: z.string().max(5000).default(""),
  challenges: z.string().max(5000).default(""),
  lessonsLearned: z.string().max(5000).default(""),
  nextSteps: z.string().max(5000).default(""),
  attachedEvidenceIds: z.array(z.string()).default([]),
});
export type CreateActivityUpdateInput = z.infer<typeof CreateActivityUpdateSchema>;

export const PolishActivitySchema = z.object({
  activityId: z.string().min(1),
});

export const ReviewActivitySchema = z.object({
  activityId: z.string().min(1),
  decision: z.enum(["ACCEPT", "REVISE", "REJECT"]),
  notes: z.string().max(2000).optional(),
});

export const PatchActivitySchema = z.object({
  summary: z.string().min(1).max(10000).optional(),
  achievements: z.string().max(5000).optional(),
  challenges: z.string().max(5000).optional(),
  lessonsLearned: z.string().max(5000).optional(),
  nextSteps: z.string().max(5000).optional(),
  location: z.string().max(200).optional(),
  indicatorId: z.string().optional(),
  outputId: z.string().optional(),
});

export const UpdateActivitySchema = z.object({
  activityId: z.string().min(1),
  patch: PatchActivitySchema.optional(),
  attachEvidenceIds: z.array(z.string()).optional(),
  detachEvidenceIds: z.array(z.string()).optional(),
});
export type UpdateActivityInput = z.infer<typeof UpdateActivitySchema>;

export const AttachEvidenceSchema = z.object({
  evidenceId: z.string().min(1),
  activityId: z.string().min(1).optional(),
  indicatorId: z.string().min(1).optional(),
});
export type AttachEvidenceInput = z.infer<typeof AttachEvidenceSchema>;

export const DetachEvidenceSchema = z.object({
  evidenceId: z.string().min(1),
  activityId: z.string().min(1).optional(),
  indicatorId: z.string().min(1).optional(),
});
export type DetachEvidenceInput = z.infer<typeof DetachEvidenceSchema>;
