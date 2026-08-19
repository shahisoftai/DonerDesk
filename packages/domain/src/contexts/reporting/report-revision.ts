import { DomainError } from "../../core/domain-error.js";
import {
  AssuranceState,
  ChangeOrigin,
  canTransitionAssurance,
  initialAssuranceState,
  assuranceRequiresReview,
} from "./assurance.js";

export interface ReportRevisionProps {
  draftId: string;
  sectionId: string;
  revisionNumber: number;
  parentRevisionId?: string;
  content: string;
  /** SHA-256 hex of the normalized content, computed by infrastructure. */
  contentHash: string;
  changeOrigin: ChangeOrigin;
  actorId: string;
  modelId?: string;
  promptVersion?: number;
  /** Optional structured generation-run record for rewrites. */
  generationRunId?: string;
  assuranceState: AssuranceState;
}

const HEX_RE = /^[0-9a-fA-F]{16,128}$/;

export class ReportRevision {
  private constructor(
    readonly id: string,
    readonly tenantIdValue: string,
    private props: ReportRevisionProps,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static create(input: {
    id: string;
    tenantId: string;
    draftId: string;
    sectionId: string;
    revisionNumber: number;
    parentRevisionId?: string;
    content: string;
    contentHash: string;
    changeOrigin: ChangeOrigin;
    actorId: string;
    modelId?: string;
    promptVersion?: number;
    generationRunId?: string;
  }): ReportRevision {
    if (!input.id || !input.draftId || !input.sectionId) {
      throw new Error("ReportRevision requires id, draftId, and sectionId");
    }
    if (!Number.isInteger(input.revisionNumber) || input.revisionNumber < 1) {
      throw DomainError.validation("ReportRevision revisionNumber must be a positive integer");
    }
    if (input.contentHash.length < 16 || !HEX_RE.test(input.contentHash)) {
      throw DomainError.validation("ReportRevision contentHash must be a hex digest");
    }
    const now = new Date();
    return new ReportRevision(
      input.id,
      input.tenantId,
      {
        draftId: input.draftId,
        sectionId: input.sectionId,
        revisionNumber: input.revisionNumber,
        parentRevisionId: input.parentRevisionId,
        content: input.content,
        contentHash: input.contentHash,
        changeOrigin: input.changeOrigin,
        actorId: input.actorId,
        modelId: input.modelId,
        promptVersion: input.promptVersion,
        generationRunId: input.generationRunId,
        assuranceState: initialAssuranceState(),
      },
      now,
      now,
    );
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    props: ReportRevisionProps;
    createdAt: Date;
    updatedAt: Date;
  }): ReportRevision {
    return new ReportRevision(input.id, input.tenantId, input.props, input.createdAt, input.updatedAt);
  }

  get draftId(): string { return this.props.draftId; }
  get sectionId(): string { return this.props.sectionId; }
  get revisionNumber(): number { return this.props.revisionNumber; }
  get parentRevisionId(): string | undefined { return this.props.parentRevisionId; }
  get content(): string { return this.props.content; }
  get contentHash(): string { return this.props.contentHash; }
  get changeOrigin(): ChangeOrigin { return this.props.changeOrigin; }
  get actorId(): string { return this.props.actorId; }
  get modelId(): string | undefined { return this.props.modelId; }
  get promptVersion(): number | undefined { return this.props.promptVersion; }
  get generationRunId(): string | undefined { return this.props.generationRunId; }
  get assuranceState(): AssuranceState { return this.props.assuranceState; }
  get requiresReview(): boolean { return assuranceRequiresReview(this.props.assuranceState); }

  private transition(to: AssuranceState): void {
    if (!canTransitionAssurance(this.props.assuranceState, to)) {
      throw DomainError.invalidTransition(
        `ReportRevision cannot transition from ${this.props.assuranceState} to ${to}`,
        { revisionId: this.id, from: this.props.assuranceState, to },
      );
    }
    this.props.assuranceState = to;
  }

  markAssessing(): void {
    this.transition("ASSESSING");
  }

  markCurrent(): void {
    this.transition("CURRENT");
  }

  markFailed(): void {
    this.transition("FAILED");
  }

  /** Evidence the revision cites changed; assurance can no longer be trusted. */
  markStale(): void {
    this.transition("STALE");
  }

  static newRevisionNumber(parent: ReportRevision | null): number {
    return parent ? parent.revisionNumber + 1 : 1;
  }
}
