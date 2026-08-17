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
  /** Required for managed (byte-backed) uploads that live in a project workspace folder. */
  projectId?: string;
  evidenceId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  /** Present for byte-backed uploads (LOCAL / R2 / Drive-managed upload). */
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

/**
 * Reads cell values from a Google Sheets spreadsheet (server-side, using the
 * tenant's Drive OAuth connection). Implementations parse the URL/spreadsheet id,
 * refresh the access token, and return the sheet as a raw header + rows grid.
 */
export interface ISheetReader {
  readSheet(input: { tenantId: string; sheetUrl: string }): Promise<Result<{ headers: string[]; rows: string[][] }, DomainError>>;
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

/** A resolved external workspace reference (Drive folder id or local path root). */
export interface WorkspaceReference {
  provider: "GOOGLE_DRIVE" | "LOCAL" | "R2";
  rootId: string;
  /** Presentation deep-link when the provider supports one (Drive folder url). */
  deepLink?: string;
  /** Applies when the workspace is a folder tree; lists the provisioned subfolders. */
  subfolders?: Array<{ role: string; id: string }>;
}

/** A file listed from a project workspace folder (Google Drive or local mirror). */
export interface DriveFileEntry {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  webViewLink?: string;
}

/**
 * Provisions and verifies a tenant-scoped project workspace (folder tree) in the
 * configured storage provider. Implementations are idempotent and repairable.
 */
export interface IProjectWorkspaceService {
  /** Ensure the tenant "DonorDesk" root folder exists; returns its Drive id. */
  ensureTenantRoot(tenantId: TenantId): Promise<Result<WorkspaceReference, DomainError>>;
  /** Ensure THIS project's folder tree exists under the tenant root. */
  ensureProjectWorkspace(tenantId: TenantId, projectId: string): Promise<Result<WorkspaceReference, DomainError>>;
  /** Verify the tenant can still access a previously provisioned root. */
  verifyAccess(tenantId: TenantId, rootId: string): Promise<Result<void, DomainError>>;
  /** Verify/repair the project tree; returns the (possibly repaired) reference. */
  repairProjectWorkspace(tenantId: TenantId, projectId: string): Promise<Result<WorkspaceReference, DomainError>>;
  /** List files currently in one project workspace folder role (idempotent; provisions if missing). */
  listProjectFolderFiles(tenantId: TenantId, projectId: string, role: string): Promise<Result<DriveFileEntry[], DomainError>>;
}

export interface ProjectWorkspaceProviderConfig {
  provider: "GOOGLE_DRIVE" | "LOCAL" | "R2";
}

/** Downloaded content of a Google Drive file, ready for parsing. */
export interface DriveFileContent {
  bytes: Buffer;
  /** Effective parse mime type (native Docs/Sheets are exported to a parseable format). */
  mimeType: string;
  name: string;
}

/**
 * Downloads Google Drive file content by id using the tenant's OAuth
 * credentials. Native Google Docs/Sheets are exported to a text/plain or CSV
 * representation so they can be parsed.
 */
export interface IDriveFileContentReader {
  read(tenantId: TenantId, fileId: string): Promise<Result<DriveFileContent, DomainError>>;
}

/**
 * Resolves the workspace strategy for a tenant so provisioning can decide
 * whether a Drive tree is required or explicitly not required (LOCAL/R2).
 */
export interface IProjectWorkspaceProviderResolver {
  resolve(tenantId: TenantId): Promise<Result<ProjectWorkspaceProviderConfig, DomainError>>;
}
