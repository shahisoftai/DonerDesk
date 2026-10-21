import { z } from "zod";

export const RiskKindSchema = z.enum(["PROBLEM", "RISK", "ASSUMPTION", "DECISION", "DEPENDENCY"]);
export const SeriousnessSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);

/** The four things a person says: what it is (and whether it has happened), how serious, who handles it, what is being done. */
export const CreateRiskSchema = z.object({
  kind: RiskKindSchema,
  title: z.string().trim().min(1).max(200),
  seriousness: SeriousnessSchema,
  ownerId: z.string().min(1).optional(),
  action: z.string().max(1000).default(""),
  /** The planned activity it affects, when raised from one. */
  plannedActivityId: z.string().min(1).optional(),
});
export type CreateRiskInput = z.infer<typeof CreateRiskSchema>;

/** `ownerId: null` means nobody is handling it. */
export const UpdateRiskSchema = z.object({
  kind: RiskKindSchema.optional(),
  title: z.string().trim().min(1).max(200).optional(),
  seriousness: SeriousnessSchema.optional(),
  ownerId: z.string().min(1).nullable().optional(),
  action: z.string().max(1000).optional(),
});
export type UpdateRiskInput = z.infer<typeof UpdateRiskSchema>;

export const CloseRiskSchema = z.object({ note: z.string().max(1000).optional() });
export type CloseRiskInput = z.infer<typeof CloseRiskSchema>;

/** A change of plan, recorded: what changed, why, and what it did to the results; optionally the activity, indicator or report it touches. */
export const RecordAdaptationSchema = z.object({
  recordedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Write the day as YYYY-MM-DD"),
  whatChanged: z.string().trim().min(1).max(500),
  why: z.string().trim().min(1).max(1000),
  effectOnResults: z.string().trim().max(1000).optional(),
  plannedActivityId: z.string().optional(),
  indicatorId: z.string().optional(),
  reportingPeriodId: z.string().optional(),
});
export type RecordAdaptationInput = z.infer<typeof RecordAdaptationSchema>;
export const UpdateAdaptationSchema = RecordAdaptationSchema.partial();
