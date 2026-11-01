import { z } from "zod";
import { ProjectSetupProposalSchema, SETUP_AREA_KEYS, SetupProblemSchema } from "@donordesk/contracts";

const Run = z.object({
  id: z.string(),
  kind: z.enum(["EXTRACT", "APPLY"]),
  area: z.string().nullish(),
  status: z.enum(["RUNNING", "FINISHED", "FAILED"]),
  detail: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
  startedAt: z.string(),
  finishedAt: z.string().nullish(),
});

const StoredProposal = z.object({
  id: z.string(),
  status: z.enum(["EXTRACTING", "READY", "APPLYING", "APPLIED", "PARTIAL", "FAILED", "DISCARDED"]),
  sourceName: z.string(),
  proposal: ProjectSetupProposalSchema,
  problems: z.array(SetupProblemSchema).default([]),
  appliedProjectId: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string(),
});

export const SetupProposalViewSchema = z.object({
  /** What reading the document asked of the AI service; `costUsd` is null when the model has no price on file. */
  usage: z.object({ calls: z.number(), inputTokens: z.number(), outputTokens: z.number(), costUsd: z.number().nullable() }).default({ calls: 0, inputTokens: 0, outputTokens: 0, costUsd: null }),
  proposal: StoredProposal,
  problems: z.array(SetupProblemSchema),
  runs: z.array(Run),
  areas: z.array(z.object({
    area: z.enum(SETUP_AREA_KEYS),
    labelKey: z.string(),
    fields: z.array(z.string()),
    items: z.number(),
    accepted: z.number(),
  })),
});
export type SetupProposalView = z.infer<typeof SetupProposalViewSchema>;

export const SetupProposalListSchema = z.object({
  proposals: z.array(z.object({
    id: z.string(),
    status: z.string(),
    sourceName: z.string(),
    appliedProjectId: z.string().nullish(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })),
});

export const SetupStartedSchema = z.object({ proposalId: z.string(), status: z.string(), sourceName: z.string() });

export const SetupPreviewSchema = z.object({
  plan: z.object({
    steps: z.array(z.object({ area: z.enum(SETUP_AREA_KEYS), order: z.number(), items: z.number() })),
    skipped: z.array(z.object({ area: z.enum(SETUP_AREA_KEYS), reason: z.string(), missingDependency: z.string().optional() })),
  }),
  areas: z.array(z.object({ area: z.enum(SETUP_AREA_KEYS), items: z.number(), notes: z.array(z.string()) })),
  draft: z.record(z.string()),
  missing: z.array(z.string()),
  blocking: z.array(SetupProblemSchema),
  problems: z.array(SetupProblemSchema),
});
export type SetupPreview = z.infer<typeof SetupPreviewSchema>;

export const SetupApplyResultSchema = z.object({
  projectId: z.string(),
  status: z.enum(["APPLIED", "PARTIAL"]),
  /** Where each source document ended up in the organisation's Drive, or why it has not moved yet. */
  documents: z.array(z.object({ name: z.string(), folder: z.string().optional(), link: z.string().optional(), error: z.string().optional() })).optional(),
  areas: z.array(z.object({
    area: z.enum(SETUP_AREA_KEYS),
    status: z.enum(["APPLIED", "ALREADY_APPLIED", "FAILED", "NOT_RUN"]),
    created: z.number(),
    skipped: z.number(),
    notes: z.array(z.string()),
    error: z.string().optional(),
  })),
});
export type SetupApplyResult = z.infer<typeof SetupApplyResultSchema>;

export const SetupEditedSchema = z.object({ ok: z.literal(true), updatedAt: z.string() });

/** The passage a proposed item was read from, as the model saw it. */
export const SetupPassageSchema = z.object({ documentName: z.string(), sheet: z.string().nullable(), text: z.string(), before: z.string().nullable() });
export type SetupPassage = z.infer<typeof SetupPassageSchema>;

export const SetupRereadSchema = z.object({ rereading: z.array(z.string()) });
