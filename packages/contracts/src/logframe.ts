import { z } from "zod";

export const LogframeLevelSchema = z.enum(["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"]);

export const IndicatorTypeSchema = z.enum(["NUMBER", "PERCENTAGE", "YES_NO", "TEXT", "RATIO", "CURRENCY", "CUSTOM"]);

export const CreateLogframeItemSchema = z.object({
  projectId: z.string().min(1),
  parentId: z.string().optional(),
  level: LogframeLevelSchema,
  code: z.string().max(50).optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
});
export type CreateLogframeItemInput = z.infer<typeof CreateLogframeItemSchema>;

export const CreateIndicatorSchema = z.object({
  projectId: z.string().min(1),
  logframeItemId: z.string().min(1),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(300),
  type: IndicatorTypeSchema,
  baseline: z.string().max(100).default(""),
  target: z.string().max(100).default(""),
  unit: z.string().max(50).optional(),
  meansOfVerification: z.string().max(500).optional(),
  dataSource: z.string().max(500).optional(),
  frequency: z.string().max(50).optional(),
  responsibleUserId: z.string().optional(),
  disaggregationRequired: z.boolean().default(false),
});
export type CreateIndicatorInput = z.infer<typeof CreateIndicatorSchema>;

export const CreateIndicatorUpdateSchema = z.object({
  indicatorId: z.string().min(1),
  reportingPeriodId: z.string().min(1),
  periodAchievement: z.string(),
  cumulativeAchievement: z.string(),
  comments: z.string().optional(),
  dataSource: z.string().optional(),
  attachedEvidenceIds: z.array(z.string()).default([]),
});
export type CreateIndicatorUpdateInput = z.infer<typeof CreateIndicatorUpdateSchema>;
