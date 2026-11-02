import { SETUP_MAX_DOCUMENTS } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../context.js";
import type { DefaultPack, DomainError, ProjectSetupProposal, Result, SetupAreaKey, SetupExtras, SetupProblem, SourceBlock, TenantId } from "@donordesk/domain";

/** The stored proposal's lifecycle: EXTRACTING while the document is being read, READY for review, the APPLY* states come with Phase 36.3. */
export type SetupProposalStatus = "EXTRACTING" | "READY" | "APPLYING" | "APPLIED" | "PARTIAL" | "FAILED" | "DISCARDED";

export interface StoredSetupProposal {
  id: string;
  tenantId: TenantId;
  createdById: string;
  status: SetupProposalStatus;
  sourceName: string;
  /** Storage key of the uploaded document (the encrypting storage); deleted at expiry or on discard, never exported. */
  sourceStorageKey: string;
  sourceHash: string;
  sourceLength: number;
  proposal: ProjectSetupProposal;
  /** The wizard's own decisions (team, owners, collection, schedule, finance, answers, sign-off); absent on a proposal made before the wizard. */
  extras?: SetupExtras | undefined;
  /** The latest `checkProposal` problems (recomputed on read as well). */
  problems: SetupProblem[];
  appliedProjectId?: string | undefined;
  promptVersion?: string | undefined;
  model?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
  /** The stored source is deleted at expiry (30 days) or on discard. */
  expiresAt: Date;
}

export interface StoredSetupRun {
  id: string;
  tenantId: TenantId;
  proposalId: string;
  kind: "EXTRACT" | "APPLY" | "LAUNCH";
  /** The one area a rerun or apply step covered; undefined for a whole-document extraction. */
  area?: SetupAreaKey | undefined;
  status: "RUNNING" | "FINISHED" | "FAILED";
  /** Counts, dropped items, timings; never document text. */
  detail: Record<string, string | number | boolean>;
  startedAt: Date;
  finishedAt?: Date | undefined;
}

export interface ISetupProposalRepository {
  create(p: StoredSetupProposal): Promise<Result<void>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredSetupProposal | null>>;
  /** Writes every mutable field (`?? null`); with `expectedUpdatedAt` the write happens only if nobody saved in between, else `false`. */
  update(p: StoredSetupProposal, expectedUpdatedAt?: Date): Promise<Result<boolean>>;
  /** Writes only the wizard's decisions, and only if nobody saved since `expectedUpdatedAt`; `false` = someone did. Never touches the proposal, so a running extraction cannot lose an edit. */
  updateExtras(id: string, tenantId: TenantId, extras: SetupExtras, expectedUpdatedAt: Date): Promise<Result<boolean>>;
  /** The person's own proposals, newest first. */
  listForCreator(tenantId: TenantId, createdById: string): Promise<Result<StoredSetupProposal[]>>;
  /** How many proposals the organisation started in the window, for the daily cap. */
  countStartedSince(tenantId: TenantId, since: Date): Promise<Result<number>>;
  /** Deletes the proposal and its runs; the caller removes the stored source first. */
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
}

export interface ISetupRunRepository {
  start(r: StoredSetupRun): Promise<Result<void>>;
  /** Updates the detail while the run is going. */
  progress(id: string, tenantId: TenantId, detail: Record<string, string | number | boolean>): Promise<Result<void>>;
  finish(id: string, tenantId: TenantId, detail: Record<string, string | number | boolean>, at: Date): Promise<Result<void>>;
  fail(id: string, tenantId: TenantId, detail: Record<string, string | number | boolean>, at: Date): Promise<Result<void>>;
  find(id: string, tenantId: TenantId): Promise<Result<StoredSetupRun | null>>;
  listByProposal(proposalId: string, tenantId: TenantId): Promise<Result<StoredSetupRun[]>>;
  /** Deletes every run of one proposal (used by discard). */
  deleteByProposal(proposalId: string, tenantId: TenantId): Promise<Result<void>>;
}

/** Where a stored source document came from, enough to read it back. */
export interface SetupSourceRef {
  tenantId: TenantId;
  storageKey: string;
  fileName: string;
}

/** A source key that points at files in the organisation's own Google Drive: `drive:<file id>[,<file id>…]` (a setup may use several documents). */
const DRIVE_KEY_PREFIX = "drive:";
export const driveSourceKey = (fileIds: readonly string[]): string => `${DRIVE_KEY_PREFIX}${fileIds.join(",")}`;
/** The Drive file ids inside a source key; empty for a key from before documents moved to the organisation's Drive. */
export const driveFileIdsOf = (storageKey: string): string[] =>
  storageKey.startsWith(DRIVE_KEY_PREFIX) ? storageKey.slice(DRIVE_KEY_PREFIX.length).split(",").filter((id) => id.length > 0) : [];

/** A setup is built from up to this many documents, all about the same project (one constant, shared with the screen). */
export const MAX_SETUP_DOCUMENTS = SETUP_MAX_DOCUMENTS;

export interface StagedSetupDocument {
  fileId: string;
  webLink?: string | undefined;
}

export interface MovedSetupDocument {
  /** The document's own name in Drive. */
  name?: string | undefined;
  /** The project folder the document now sits in, by name. */
  folder: string;
  webLink?: string | undefined;
}

/**
 * Where a project document lives: the organisation's own Google Drive, never DonorDesk's servers. The bytes pass through the
 * server's memory while they are sent to Drive and read back for reading, and are not kept. Before the project exists the
 * file sits in a staging folder in the organisation's DonorDesk Drive folder; once the project is created it moves into the
 * project's own folder.
 */
export interface ISetupDocumentStore {
  /** True when the organisation has a connected Drive that can hold the document. */
  available(tenantId: TenantId): Promise<boolean>;
  stage(tenantId: TenantId, doc: { name: string; mimeType: string; bytes: Buffer }): Promise<Result<StagedSetupDocument, DomainError>>;
  read(tenantId: TenantId, fileId: string): Promise<Result<{ bytes: Buffer; mimeType: string; name: string }, DomainError>>;
  /** Moves the file into the project's own folder. Safe to repeat: a file already there stays there. */
  moveToProject(tenantId: TenantId, fileId: string, projectId: string): Promise<Result<MovedSetupDocument, DomainError>>;
  /** Removes a document that is still in the staging folder. A file anywhere else is left alone. */
  removeStaged(tenantId: TenantId, fileId: string): Promise<Result<void, DomainError>>;
}

/**
 * The one place that knows how a stored document becomes readable blocks (the existing parsers, OCR fallback and
 * plain-language refusals included). Implementations wrap `ParseUploadedFileHandler`; nothing else parses.
 */
export interface ISourceDocumentReader {
  read(source: SetupSourceRef): Promise<Result<SourceBlock[], DomainError>>;
}

export interface SetupExtractInput {
  tenantId: TenantId;
  proposalId: string;
  area: SetupAreaKey;
  /** The document's readable blocks (not redacted here; redaction happens in the orchestrator before any model call). */
  blocks: ReadonlyArray<SourceBlock>;
  /** The document text redacted the same way the model will see it: the grounding reference. */
  sourceText: string;
  /** Fields already extracted for the areas this one depends on (facts, logframe, ...). */
  prior: Readonly<Record<string, unknown>>;
  maxTokens: number;
  timeoutMs: number;
}

/** What the AI service was asked for while reading: calls and tokens, so a document's cost can be shown. */
export interface SetupUsage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ExtractedArea {
  usage?: SetupUsage | undefined;
  /** Proposal fields this area owns (`facts`, `logframe`, `funding` and `budget` together, ...), each with its proposed items. */
  fields: Readonly<Record<string, unknown>>;
  /** True when the document was too large to read in full: the area reports it instead of silently truncating. */
  partlyRead?: boolean | undefined;
  model?: string | undefined;
  promptVersion?: string | undefined;
}

/** One extractor per area; registered in the container and iterated by the orchestrator, which knows no area internals. */
export interface ISetupAreaExtractor {
  readonly area: SetupAreaKey;
  /**
   * True when this document can be read for the area without calling the AI service (a logframe or work-plan sheet).
   * Optional: an extractor that always needs the model leaves it out. Used to keep going when the AI is rate limited.
   */
  canReadWithoutModel?(blocks: ReadonlyArray<SourceBlock>): boolean;
  /** True when this block belongs to the area by what it is (a budget sheet, a Gantt chart) or by its heading; used to show what each file feeds. */
  feeds?(block: SourceBlock): boolean;
  extract(input: SetupExtractInput): Promise<Result<ExtractedArea, DomainError>>;
}

export interface SetupApplyContext {
  /** The person applying; every delegated handler checks its own permission against it. */
  auth: AuthenticatedContext;
  proposalId: string;
}

export interface SetupApplyPreview {
  /** How many items the area's ordinary handler will be given. */
  items: number;
  /** Plain sentences for items left out, and why. */
  notes: string[];
}

export interface SetupApplyOutcome {
  created: number;
  skipped: number;
  notes: string[];
}

/** One applier per area: it turns accepted items into the existing handler's input and calls it; nothing else writes. */
export interface ISetupAreaApplier {
  readonly area: SetupAreaKey;
  /** Writes nothing. */
  dryRun(ctx: SetupApplyContext, proposal: ProjectSetupProposal): Promise<Result<SetupApplyPreview, DomainError>>;
  /** Delegates to the area's existing handler; the handler's own skips make a repeat create nothing twice. */
  apply(ctx: SetupApplyContext, projectId: string, proposal: ProjectSetupProposal): Promise<Result<SetupApplyOutcome, DomainError>>;
}

export interface SetupLlmCompletion {
  usage?: { inputTokens: number; outputTokens: number } | undefined;
  text: string;
  model: string;
  promptVersion: string;
}

/** The narrow LLM facade extraction needs: one JSON completion, tenant-resolved; null provider = the feature is unavailable. */
export interface ISetupLlm {
  available(tenantId: TenantId): Promise<boolean>;
  completeJson(input: { tenantId: TenantId; system: string; user: string; maxTokens: number; timeoutMs: number }): Promise<Result<SetupLlmCompletion | null, DomainError>>;
}

/** Where the default packs come from: the ones that ship with DonorDesk, and (later) the organisation's own copies. */
export interface IDefaultPackSource {
  list(tenantId: TenantId): Promise<DefaultPack[]>;
}

/** The organisation's own default packs, one per sector (or "GENERAL"). The pack is the checked `DefaultPack`, stored whole. */
export interface ISetupPackRepository {
  list(tenantId: TenantId): Promise<Result<StoredSetupPack[], DomainError>>;
  save(tenantId: TenantId, sectorKey: string, pack: DefaultPack, updatedById: string): Promise<Result<void, DomainError>>;
  remove(tenantId: TenantId, sectorKey: string): Promise<Result<boolean, DomainError>>;
}

export interface StoredSetupPack { sectorKey: string; pack: DefaultPack; updatedAt: Date; updatedById: string }
