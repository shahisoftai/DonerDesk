import { z } from "zod";

export const RiskKindSchema = z.enum(["PROBLEM", "RISK"]);
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
