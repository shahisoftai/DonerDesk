import { DomainError } from "../../core/domain-error.js";

export type SubmissionSnapshotStatus = "SEALED" | "VOID";

export interface ApprovalRecord {
  sectionId: string;
  revisionId: string;
  revisionHash: string;
  approvedById: string;
  approvedAt: Date;
}

export interface AssertionManifestEntry {
  assertionId: string;
  revisionId: string;
  text: string;
  verificationResult: string;
  verificationReasonCode?: string;
}

export interface EvidenceManifestEntry {
  evidenceId: string;
  fileName: string;
  hash: string;
  confidentialityDecision: "INCLUDE" | "EXCLUDE" | "REDACTED";
}

export interface AnnexManifestEntry {
  annexTitle: string;
  populated: boolean;
}

export interface AuthorizedOverride {
  claimId: string;
  resolution: "ACCEPTED_WITH_LIMITATION" | "EXCLUDED";
  notes: string;
  authority: string;
}

export interface ArtifactHashEntry {
  artifactType: string;
  hash: string;
}

export interface SubmissionSnapshotProps {
  reportDraftId: string;
  reportingPeriodId: string;
  approvedRevisionIds: string[];
  revisionHashes: Record<string, string>;
  requirementSnapshotId: string;
  requirementCoverage: { satisfied: string[]; unmet: string[] };
  assertionManifest: AssertionManifestEntry[];
  evidenceManifest: EvidenceManifestEntry[];
  annexManifest: AnnexManifestEntry[];
  templateMappingId?: string;
  templateMappingVersion?: number;
  approvalRecords: ApprovalRecord[];
  overrides: AuthorizedOverride[];
  rendererVersion?: string;
  artifactHashes: ArtifactHashEntry[];
  status: SubmissionSnapshotStatus;
}

/**
 * Immutable donor-submission boundary. Every donor-facing export references
 * exactly one submission snapshot; internal previews may exist without one but
 * must be visibly watermarked. A snapshot freezes the exact revision hashes,
 * requirement snapshot, assertion manifest, evidence/annex manifests, approval
 * records, and renderer versions used to produce the final artifact.
 */
export class SubmissionSnapshot {
  private constructor(
    readonly id: string,
    readonly tenantIdValue: string,
    readonly projectId: string,
    private props: SubmissionSnapshotProps,
    readonly createdAt: Date,
    readonly sealedAt: Date,
  ) {}

  static create(input: {
    id: string;
    tenantId: string;
    projectId: string;
    reportDraftId: string;
    reportingPeriodId: string;
    approvedRevisionIds: string[];
    revisionHashes: Record<string, string>;
    requirementSnapshotId: string;
    requirementCoverage?: { satisfied: string[]; unmet: string[] };
    assertionManifest?: AssertionManifestEntry[];
    evidenceManifest?: EvidenceManifestEntry[];
    annexManifest?: AnnexManifestEntry[];
    templateMappingId?: string;
    templateMappingVersion?: number;
    approvalRecords?: ApprovalRecord[];
    overrides?: AuthorizedOverride[];
    rendererVersion?: string;
    artifactHashes?: ArtifactHashEntry[];
  }): SubmissionSnapshot {
    if (!input.reportDraftId || !input.reportingPeriodId) {
      throw DomainError.validation("SubmissionSnapshot requires reportDraftId and reportingPeriodId");
    }
    if (input.approvedRevisionIds.length === 0) {
      throw DomainError.validation("SubmissionSnapshot requires at least one approved revision");
    }
    for (const revisionId of input.approvedRevisionIds) {
      if (!input.revisionHashes[revisionId]) {
        throw DomainError.validation(`SubmissionSnapshot missing hash for revision ${revisionId}`);
      }
    }
    const now = new Date();
    return new SubmissionSnapshot(
      input.id,
      input.tenantId,
      input.projectId,
      {
        reportDraftId: input.reportDraftId,
        reportingPeriodId: input.reportingPeriodId,
        approvedRevisionIds: [...input.approvedRevisionIds],
        revisionHashes: { ...input.revisionHashes },
        requirementSnapshotId: input.requirementSnapshotId,
        requirementCoverage: input.requirementCoverage ?? { satisfied: [], unmet: [] },
        assertionManifest: input.assertionManifest ?? [],
        evidenceManifest: input.evidenceManifest ?? [],
        annexManifest: input.annexManifest ?? [],
        templateMappingId: input.templateMappingId,
        templateMappingVersion: input.templateMappingVersion,
        approvalRecords: input.approvalRecords ?? [],
        overrides: input.overrides ?? [],
        rendererVersion: input.rendererVersion,
        artifactHashes: input.artifactHashes ?? [],
        status: "SEALED",
      },
      now,
      now,
    );
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    projectId: string;
    props: SubmissionSnapshotProps;
    createdAt: Date;
    sealedAt: Date;
  }): SubmissionSnapshot {
    return new SubmissionSnapshot(input.id, input.tenantId, input.projectId, input.props, input.createdAt, input.sealedAt);
  }

  get reportDraftId(): string { return this.props.reportDraftId; }
  get reportingPeriodId(): string { return this.props.reportingPeriodId; }
  get approvedRevisionIds(): string[] { return [...this.props.approvedRevisionIds]; }
  get revisionHashes(): Record<string, string> { return { ...this.props.revisionHashes }; }
  get requirementSnapshotId(): string { return this.props.requirementSnapshotId; }
  get requirementCoverage(): { satisfied: string[]; unmet: string[] } {
    return { satisfied: [...this.props.requirementCoverage.satisfied], unmet: [...this.props.requirementCoverage.unmet] };
  }
  get assertionManifest(): AssertionManifestEntry[] { return [...this.props.assertionManifest]; }
  get evidenceManifest(): EvidenceManifestEntry[] { return [...this.props.evidenceManifest]; }
  get annexManifest(): AnnexManifestEntry[] { return [...this.props.annexManifest]; }
  get templateMappingId(): string | undefined { return this.props.templateMappingId; }
  get templateMappingVersion(): number | undefined { return this.props.templateMappingVersion; }
  get approvalRecords(): ApprovalRecord[] { return [...this.props.approvalRecords]; }
  get overrides(): AuthorizedOverride[] { return [...this.props.overrides]; }
  get rendererVersion(): string | undefined { return this.props.rendererVersion; }
  get artifactHashes(): ArtifactHashEntry[] { return [...this.props.artifactHashes]; }
  get status(): SubmissionSnapshotStatus { return this.props.status; }

  addArtifactHash(entry: ArtifactHashEntry): void {
    if (this.props.status !== "SEALED") {
      throw DomainError.invalidTransition("Cannot add artifact hashes to a voided snapshot");
    }
    this.props.artifactHashes = [...this.props.artifactHashes, entry];
  }

  void(): void {
    if (this.props.status === "VOID") return;
    this.props.status = "VOID";
  }
}
