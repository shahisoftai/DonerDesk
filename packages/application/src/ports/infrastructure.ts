import type { TenantId } from "@donordesk/domain";
import type { StorageProvider } from "@donordesk/domain";
import type { Result } from "@donordesk/domain";
import type { DomainError } from "@donordesk/domain";

export interface StoragePutInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StoragePutResult {
  url: string;
  key: string;
  size: number;
}

export interface IStorage {
  put(input: StoragePutInput): Promise<StoragePutResult>;
  getSignedUrl(key: string, ttlSeconds: number): Promise<string>;
  remove(key: string): Promise<void>;
}

/**
 * A reference to where an evidence file actually lives. For byte-backed storage
 * (LOCAL / R2) `fileUrl` is a served URL and `storageKey` identifies the blob.
 * For GOOGLE_DRIVE the file stays in the tenant's Drive; `driveFileId` and
 * `driveWebLink` identify it and `fileUrl` is a resolved access link.
 */
export interface EvidenceLocation {
  provider: StorageProvider;
  fileUrl: string;
  fileSize: number;
  storageKey?: string;
  driveFileId?: string;
  driveWebLink?: string;
}

export interface SaveEvidenceInput {
  tenantId: string;
  evidenceId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  /** Present for byte-backed uploads (LOCAL / R2). */
  buffer?: Buffer;
  /** Present for Google Drive reference uploads (no bytes copied). */
  driveFileId?: string;
  driveWebLink?: string;
}

/**
 * Provider-agnostic evidence storage. Concrete adapters decide whether the
 * bytes are copied (LOCAL/R2) or referenced in place (Google Drive).
 */
export interface IEvidenceStorage {
  readonly provider: StorageProvider;
  save(input: SaveEvidenceInput): Promise<Result<EvidenceLocation, DomainError>>;
  resolveDownloadUrl(location: EvidenceLocation, ttlSeconds: number): Promise<string>;
  remove(location: EvidenceLocation): Promise<void>;
  /** Byte-backed adapters expose this so the API can stream content. */
  readBytes?(location: EvidenceLocation): Promise<Buffer>;
}

/**
 * Resolves the per-tenant evidence storage adapter based on the tenant's
 * configured storage strategy (e.g. GOOGLE_DRIVE vs LOCAL/R2).
 */
export interface IEvidenceStorageResolver {
  resolve(tenantId: TenantId): Promise<IEvidenceStorage>;
}

export interface GoogleDriveAuthUrl {
  authUrl: string;
}

export interface GoogleDriveOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * Google Drive OAuth connector used during onboarding. Implementations build the
 * consent URL and exchange the authorization code for a refresh token.
 */
export interface IGoogleDriveConnector {
  buildAuthUrl(state: string): Promise<GoogleDriveAuthUrl>;
  exchangeCode(code: string): Promise<{ refreshToken: string; email?: string }>;
  /** Optionally resolves the current access token for the configured OAuth client. */
  getConfig(): Promise<GoogleDriveOAuthConfig | null>;
}

/**
 * Google Sign-In connector used at the login page. Implementations exchange the
 * OAuth authorization code for an ID token and verify it against Google's
 * public keys, returning the verified profile.
 */
export interface IGoogleSignInConnector {
  exchangeCode(code: string): Promise<{ email: string; name: string; googleSubject: string }>;
}

export interface ILLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCompletionInput {
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMCompletionResult {
  text: string;
  parsed?: unknown;
  model: string;
  promptVersion: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface ILLMProvider {
  readonly name: string;
  readonly model: string;
  readonly promptVersion: string;
  complete(input: LLMCompletionInput): Promise<LLMCompletionResult>;
}

export interface IPiiRedactor {
  redact(text: string): { redacted: string; redactionCount: number };
}

export interface IJobQueue {
  enqueue(name: string, payload: Record<string, unknown>): Promise<void>;
}

/**
 * Durable idempotency guard. Callers acquire a key before a write; a duplicate
 * key is rejected so retried / duplicate deliveries do not double-apply.
 */
export interface IdempotencyAcquireInput {
  key: string;
  tenantId: string;
  jobName: string;
  entityId: string;
}

export interface IIdempotencyStore {
  acquire(input: IdempotencyAcquireInput): Promise<Result<{ acquired: boolean }, DomainError>>;
}
