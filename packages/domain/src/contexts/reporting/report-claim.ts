export type ClaimType = "NUMERIC" | "FACTUAL" | "CAUSAL" | "QUALITATIVE";

export type VerificationResult = "PASSED" | "FAILED" | "ACCEPTED_WITH_LIMITATION" | "EXCLUDED";

export const VERIFICATION_RESULTS: VerificationResult[] = [
  "PASSED",
  "FAILED",
  "ACCEPTED_WITH_LIMITATION",
  "EXCLUDED",
];

export const CLAIM_TYPES: ClaimType[] = ["NUMERIC", "FACTUAL", "CAUSAL", "QUALITATIVE"];

/**
 * A claim source snapshots the exact bytes and chunk used at generation time.
 * Later evidence changes can never silently alter an approved report because
 * the hash, chunk text, and chunker version are recorded at generation.
 */
export interface ClaimSource {
  evidenceId: string;
  chunkId: string;
  sourceText: string;
  evidenceHash: string;
  evidenceUpdatedAt: Date;
  chunkerVersion: string;
}

export interface ReportClaimProps {
  sectionId: string;
  text: string;
  type: ClaimType;
  sources: ClaimSource[];
  verificationResult: VerificationResult;
  verificationDetail: string;
  resolutionNotes?: string;
  resolvedById?: string;
  resolvedAt?: Date;
}

export class ReportClaim {
  private constructor(
    readonly id: string,
    readonly tenantIdValue: string,
    readonly projectId: string,
    readonly reportDraftId: string,
    private props: ReportClaimProps,
    readonly createdAt: Date,
  ) {}

  static create(input: {
    id: string;
    tenantId: string;
    projectId: string;
    reportDraftId: string;
    sectionId: string;
    text: string;
    type: ClaimType;
    sources?: ClaimSource[];
    verificationResult?: VerificationResult;
    verificationDetail?: string;
  }): ReportClaim {
    if (!input.text.trim()) throw new Error("Claim text is required");
    if (!CLAIM_TYPES.includes(input.type)) throw new Error("Invalid claim type");
    if (!input.sectionId) throw new Error("Claim section is required");
    return new ReportClaim(
      input.id,
      input.tenantId,
      input.projectId,
      input.reportDraftId,
      {
        sectionId: input.sectionId,
        text: input.text.trim(),
        type: input.type,
        sources: input.sources ?? [],
        verificationResult: input.verificationResult ?? "FAILED",
        verificationDetail: input.verificationDetail ?? "",
      },
      new Date(),
    );
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    projectId: string;
    reportDraftId: string;
    props: ReportClaimProps;
    createdAt: Date;
  }): ReportClaim {
    return new ReportClaim(
      input.id,
      input.tenantId,
      input.projectId,
      input.reportDraftId,
      input.props,
      input.createdAt,
    );
  }

  get sectionId(): string { return this.props.sectionId; }
  get text(): string { return this.props.text; }
  get type(): ClaimType { return this.props.type; }
  get sources(): ClaimSource[] { return [...this.props.sources]; }
  get verificationResult(): VerificationResult { return this.props.verificationResult; }
  get verificationDetail(): string { return this.props.verificationDetail; }
  get resolutionNotes(): string | undefined { return this.props.resolutionNotes; }
  get resolvedById(): string | undefined { return this.props.resolvedById; }
  get resolvedAt(): Date | undefined { return this.props.resolvedAt ? new Date(this.props.resolvedAt.getTime()) : undefined; }

  addSource(source: ClaimSource): void {
    if (!source.evidenceId || !source.chunkId || !source.evidenceHash) {
      throw new Error("Every claim source requires evidenceId, chunkId, and evidenceHash");
    }
    this.props.sources = [...this.props.sources, source];
  }

  setVerification(result: VerificationResult, detail: string): void {
    this.props.verificationResult = result;
    this.props.verificationDetail = detail;
  }

  /**
   * Resolves the claim. ACCEPTED_WITH_LIMITATION requires a note and always
   * preserves the failed verification result — it never mutates the
   * verification status to a passed state.
   */
  resolve(input: { result: VerificationResult; notes?: string; by: string; at?: Date }): void {
    if (input.result === "ACCEPTED_WITH_LIMITATION") {
      if (!input.notes || input.notes.trim().length === 0) {
        throw new Error("ACCEPTED_WITH_LIMITATION requires an aggregate note");
      }
      if (this.props.verificationResult !== "FAILED") {
        throw new Error("Only failed claims can be accepted with a limitation");
      }
      this.props.resolutionNotes = input.notes.trim();
      this.props.resolvedById = input.by;
      this.props.resolvedAt = input.at ?? new Date();
      return;
    }
    if (input.result === "EXCLUDED") {
      this.props.resolutionNotes = input.notes ?? this.props.resolutionNotes;
      this.props.resolvedById = input.by;
      this.props.resolvedAt = input.at ?? new Date();
      return;
    }
    throw new Error(`Resolution ${input.result} is applied through verification, not manual resolution`);
  }
}
