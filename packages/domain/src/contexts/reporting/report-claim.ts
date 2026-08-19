import type { NumericAtom } from "./numeric-atom.js";
import type { AssertionType, Materiality } from "./assertion.js";
import { defaultMaterialityFor, stableFingerprint } from "./assertion.js";
import type { VerificationReasonCode } from "./verification-reason.js";
import { isVerificationReasonCode } from "./verification-reason.js";

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

/**
 * The persisted claim becomes a revision-bound assertion: every claim records
 * the exact revision and content hash it belongs to plus its character span in
 * the normalized revision, so verification can never drift from content.
 */
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
  revisionId?: string;
  revisionHash?: string;
  charStart?: number;
  charEnd?: number;
  numericAtoms?: NumericAtom[];
  verificationReasonCode?: VerificationReasonCode;
  assertionType?: AssertionType;
  materiality?: Materiality;
}

export interface ReportClaimCreateInput {
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
  revisionId?: string;
  revisionHash?: string;
  charStart?: number;
  charEnd?: number;
  numericAtoms?: NumericAtom[];
  verificationReasonCode?: VerificationReasonCode;
  assertionType?: AssertionType;
  materiality?: Materiality;
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

  static create(input: ReportClaimCreateInput): ReportClaim {
    if (!input.text.trim()) throw new Error("Claim text is required");
    if (!CLAIM_TYPES.includes(input.type)) throw new Error("Invalid claim type");
    if (!input.sectionId) throw new Error("Claim section is required");
    const assertionType: AssertionType = input.assertionType ?? input.type;
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
        revisionId: input.revisionId,
        revisionHash: input.revisionHash,
        charStart: input.charStart,
        charEnd: input.charEnd,
        numericAtoms: input.numericAtoms,
        verificationReasonCode: input.verificationReasonCode,
        assertionType,
        materiality: input.materiality ?? defaultMaterialityFor(assertionType, (input.numericAtoms?.length ?? 0) > 0),
      },
      new Date(),
    );
  }

  /**
   * Builds a claim from an extracted assertion (Phase 2). The assertion id is
   * the stable semantic fingerprint used to reconcile writer claims with
   * extracted assertions. Materiality is carried over from the extractor so a
   * compliance/safeguarding/incident/budget statement stays material even
   * though its legacy ClaimType is FACTUAL.
   */
  static assert(input: {
    id: string;
    tenantId: string;
    projectId: string;
    reportDraftId: string;
    sectionId: string;
    text: string;
    type: ClaimType;
    sources?: ClaimSource[];
    charStart?: number;
    charEnd?: number;
    numericAtoms?: NumericAtom[];
    revisionId?: string;
    revisionHash?: string;
    materiality?: Materiality;
  }): ReportClaim {
    return ReportClaim.create({
      ...input,
      assertionType: mapClaimTypeToAssertionType(input.type),
    });
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
  get revisionId(): string | undefined { return this.props.revisionId; }
  get revisionHash(): string | undefined { return this.props.revisionHash; }
  get charStart(): number | undefined { return this.props.charStart; }
  get charEnd(): number | undefined { return this.props.charEnd; }
  get numericAtoms(): NumericAtom[] { return this.props.numericAtoms ? [...this.props.numericAtoms] : []; }
  get verificationReasonCode(): VerificationReasonCode | undefined { return this.props.verificationReasonCode; }
  get assertionType(): AssertionType | undefined { return this.props.assertionType; }
  get materiality(): Materiality | undefined { return this.props.materiality; }
  get fingerprint(): string { return stableFingerprint(this.props.text); }

  bindToRevision(revisionId: string, revisionHash: string): void {
    if (!revisionId || !revisionHash) {
      throw new Error("Claim revision binding requires revisionId and revisionHash");
    }
    this.props.revisionId = revisionId;
    this.props.revisionHash = revisionHash;
  }

  setSpan(charStart: number, charEnd: number): void {
    if (!Number.isInteger(charStart) || !Number.isInteger(charEnd) || charStart < 0 || charEnd <= charStart) {
      throw new Error("Claim span must satisfy 0 <= charStart < charEnd");
    }
    this.props.charStart = charStart;
    this.props.charEnd = charEnd;
  }

  setNumericAtoms(atoms: NumericAtom[]): void {
    this.props.numericAtoms = atoms.map((a) => ({ ...a }));
    if (this.props.materiality === undefined) {
      this.props.materiality = defaultMaterialityFor(this.props.assertionType ?? this.props.type, atoms.length > 0);
    }
  }

  setVerification(result: VerificationResult, detail: string, reasonCode?: VerificationReasonCode): void {
    if (reasonCode !== undefined && !isVerificationReasonCode(reasonCode)) {
      throw new Error(`Unknown verification reason code: ${reasonCode}`);
    }
    this.props.verificationResult = result;
    this.props.verificationDetail = detail;
    if (reasonCode !== undefined) this.props.verificationReasonCode = reasonCode;
  }

  addSource(source: ClaimSource): void {
    if (!source.evidenceId || !source.chunkId || !source.evidenceHash) {
      throw new Error("Every claim source requires evidenceId, chunkId, and evidenceHash");
    }
    this.props.sources = [...this.props.sources, source];
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

export function mapClaimTypeToAssertionType(type: ClaimType): AssertionType {
  return type;
}
