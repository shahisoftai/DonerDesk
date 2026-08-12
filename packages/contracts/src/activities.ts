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
