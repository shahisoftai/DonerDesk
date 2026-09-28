import { z } from "zod";

export const AgentMemoryScopeSchema = z.enum(["ORGANIZATION", "DONOR", "TEMPLATE", "SECTION_TYPE"]);
export const AgentMemoryCategorySchema = z.enum(["TONE", "STRUCTURE", "TERMINOLOGY", "FORMATTING", "LENGTH"]);
export const AgentMemoryStatusSchema = z.enum(["PROPOSED", "ACTIVE", "REJECTED", "SUPERSEDED", "DEACTIVATED"]);
export const AgentMemoryConfidenceSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const AgentMemoryProvenanceSchema = z.object({
  sourceRevisionId: z.string(),
  parentRevisionId: z.string(),
  sectionId: z.string(),
  occurrenceCount: z.number().int().nonnegative(),
  lastObservedAt: z.string(),
});

/** Wire shape for `GET /v1/agent-memory` — one row per learned/proposed statement. */
export const AgentMemorySchema = z.object({
  id: z.string(),
  scope: AgentMemoryScopeSchema,
  scopeId: z.string().nullable(),
  category: AgentMemoryCategorySchema,
  statement: z.string(),
  confidence: AgentMemoryConfidenceSchema,
  status: AgentMemoryStatusSchema,
  occurrenceCount: z.number().int().nonnegative(),
  provenance: z.array(AgentMemoryProvenanceSchema),
  approvedById: z.string().nullable(),
  approvedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AgentMemoryOutput = z.infer<typeof AgentMemorySchema>;

export const ListAgentMemorySchema = z.array(AgentMemorySchema);

/** `POST /v1/agent-memory/:id/approve` body — the reviewer's "Applies to" choice. */
export const ApproveAgentMemorySchema = z.object({
  scope: AgentMemoryScopeSchema.optional(),
  scopeId: z.string().nullable().optional(),
});
export type ApproveAgentMemoryInput = z.infer<typeof ApproveAgentMemorySchema>;

/** `PUT /v1/organization/agent-memory-settings` body — the tenant self-service toggle (§4.1). */
export const UpdateAgentMemorySettingsSchema = z.object({
  enabled: z.boolean(),
});
export type UpdateAgentMemorySettingsInput = z.infer<typeof UpdateAgentMemorySettingsSchema>;
