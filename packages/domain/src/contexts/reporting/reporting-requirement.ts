import { DomainError } from "../../core/domain-error.js";

export type RequirementKind =
  | "SECTION"
  | "QUESTION"
  | "FIELD"
  | "INDICATOR"
  | "ANNEX"
  | "DECLARATION"
  | "FINANCIAL"
  | "SAFEGUARD"
  | "APPROVAL"
  | "DEADLINE"
  | "FORMAT";

export const REQUIREMENT_KINDS: RequirementKind[] = [
  "SECTION",
  "QUESTION",
  "FIELD",
  "INDICATOR",
  "ANNEX",
  "DECLARATION",
  "FINANCIAL",
  "SAFEGUARD",
  "APPROVAL",
  "DEADLINE",
  "FORMAT",
];

export type RequirementSeverity = "INFO" | "WARNING" | "BLOCKING";

export interface RequirementCondition {
  field: string;
  operator: "equals" | "not_equals";
  value: string | boolean | number;
}

export interface EvidenceRule {
  verifiedRequired: boolean;
  confidentialityPolicy: "ANY" | "NON_CONFIDENTIAL";
}

export type RequirementSourceType =
  | "AWARD"
  | "AWARD_AMENDMENT"
  | "SCHEDULE"
  | "TEMPLATE"
  | "MECHANISM"
  | "DONOR_PACK"
  | "ORGANIZATION_PROFILE"
  | "BASELINE";

export interface RequirementSourceReference {
  sourceType: RequirementSourceType;
  sourceId: string;
  documentHash?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  version: number;
  label: string;
}

/**
 * A typed reporting requirement. `key` is the stable semantic identity used to
 * merge requirements across precedence layers (e.g. "SECTION:executive-summary"
 * or "QUESTION:safeguarding-psea"). The applicable award wins; lower layers
 * fill gaps but never silently override.
 */
export interface ReportingRequirement {
  id: string;
  key: string;
  kind: RequirementKind;
  required: boolean;
  severity: RequirementSeverity;
  condition?: RequirementCondition;
  evidenceRule?: EvidenceRule;
  wordLimit?: { min?: number; max?: number };
  sourceReference: RequirementSourceReference;
  /** Free-form guidance text for the report section/field. */
  guidance?: string;
}

export type RequirementPackStatus = "DRAFT" | "REVIEWED" | "ACTIVE" | "RETIRED";

export interface ReportingRequirementPack {
  id: string;
  tenantId?: string;
  /** Deterministic donor identity, never a broad label. */
  donorKey: string;
  mechanismKey: string;
  reportType: string;
  version: number;
  language: string;
  name: string;
  status: RequirementPackStatus;
  requirements: ReportingRequirement[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AwardReportingOverride {
  id: string;
  tenantId: string;
  projectId: string;
  awardId: string;
  effectiveFrom: string;
  effectiveTo?: string;
  documentHash?: string;
  version: number;
  status: RequirementPackStatus;
  requirements: ReportingRequirement[];
  sourceReference: RequirementSourceReference;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequirementTraceEntry {
  requirementId: string;
  key: string;
  sourceReference: RequirementSourceReference;
}

export interface ResolvedReportingRequirements {
  id: string;
  tenantId: string;
  reportingPeriodId: string;
  generationRunId?: string;
  snapshot: ReportingRequirement[];
  sourceTrace: RequirementTraceEntry[];
  /** Which requirement keys are covered by the report structure/content. */
  coverage: { satisfied: string[]; unmet: string[] };
  resolvedAt: Date;
  createdAt: Date;
}

export const REQUIREMENT_PRECEDENCE: RequirementSourceType[] = [
  "AWARD",
  "AWARD_AMENDMENT",
  "SCHEDULE",
  "MECHANISM",
  "DONOR_PACK",
  "ORGANIZATION_PROFILE",
  "BASELINE",
];

export function requirementPrecedenceIndex(sourceType: RequirementSourceType): number {
  const index = REQUIREMENT_PRECEDENCE.indexOf(sourceType);
  if (index === -1) throw new Error(`Unknown requirement source type: ${sourceType}`);
  return index;
}

export interface ResolveRequirementsInput {
  layers: Array<{
    sourceType: RequirementSourceType;
    requirements: ReportingRequirement[];
  }>;
}

/**
 * Deterministic, field-aware requirement precedence merge. For each semantic
 * key, the highest-precedence layer that defines it wins; lower layers fill
 * keys the higher layers do not define. Every resolved requirement records the
 * provenance of the layer that supplied it.
 */
export function resolveRequirements(input: ResolveRequirementsInput): {
  requirements: ReportingRequirement[];
  sourceTrace: RequirementTraceEntry[];
} {
  const merged = new Map<string, ReportingRequirement>();
  const trace = new Map<string, RequirementTraceEntry>();

  const sortedLayers = [...input.layers].sort(
    (a, b) => requirementPrecedenceIndex(a.sourceType) - requirementPrecedenceIndex(b.sourceType),
  );

  for (const layer of sortedLayers) {
    for (const requirement of layer.requirements) {
      const key = requirement.key;
      const existing = merged.get(key);
      if (existing) {
        const existingPrecedence = requirementPrecedenceIndex(existing.sourceReference.sourceType);
        const incomingPrecedence = requirementPrecedenceIndex(requirement.sourceReference.sourceType);
        if (incomingPrecedence < existingPrecedence) {
          merged.set(key, requirement);
          trace.set(key, {
            requirementId: requirement.id,
            key,
            sourceReference: requirement.sourceReference,
          });
        }
        continue;
      }
      merged.set(key, requirement);
      trace.set(key, {
        requirementId: requirement.id,
        key,
        sourceReference: requirement.sourceReference,
      });
    }
  }

  return {
    requirements: [...merged.values()],
    sourceTrace: [...trace.values()],
  };
}

export function createRequirementPack(input: {
  id: string;
  donorKey: string;
  mechanismKey: string;
  reportType: string;
  version?: number;
  language?: string;
  name: string;
  requirements: ReportingRequirement[];
  status?: RequirementPackStatus;
  tenantId?: string;
}): ReportingRequirementPack {
  if (!input.donorKey.trim() || input.donorKey.length < 4) {
    throw DomainError.validation("Requirement pack donorKey must identify the specific donor mechanism");
  }
  if (!input.mechanismKey.trim()) {
    throw DomainError.validation("Requirement pack mechanismKey is required");
  }
  if (!input.reportType.trim()) {
    throw DomainError.validation("Requirement pack reportType is required");
  }
  if (input.requirements.length === 0) {
    throw DomainError.validation("Requirement pack must define at least one requirement");
  }
  const now = new Date();
  return {
    id: input.id,
    tenantId: input.tenantId,
    donorKey: input.donorKey,
    mechanismKey: input.mechanismKey,
    reportType: input.reportType,
    version: input.version ?? 1,
    language: input.language ?? "en",
    name: input.name,
    status: input.status ?? "DRAFT",
    requirements: input.requirements,
    createdAt: now,
    updatedAt: now,
  };
}

export function createAwardOverride(input: {
  id: string;
  tenantId: string;
  projectId: string;
  awardId: string;
  effectiveFrom: string;
  effectiveTo?: string;
  documentHash?: string;
  version?: number;
  requirements: ReportingRequirement[];
  sourceReference: RequirementSourceReference;
}): AwardReportingOverride {
  if (input.requirements.length === 0) {
    throw DomainError.validation("Award override must define at least one requirement");
  }
  const now = new Date();
  return {
    id: input.id,
    tenantId: input.tenantId,
    projectId: input.projectId,
    awardId: input.awardId,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    documentHash: input.documentHash,
    version: input.version ?? 1,
    status: "DRAFT",
    requirements: input.requirements,
    sourceReference: input.sourceReference,
    createdAt: now,
    updatedAt: now,
  };
}
