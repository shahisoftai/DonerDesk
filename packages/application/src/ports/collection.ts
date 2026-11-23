import type { FormDefinition, RecordMapping, Result, TenantId } from "@donordesk/domain";

export type CollectionFormStatus = "DRAFT" | "PUBLISHED" | "CLOSED";
export type CollectionRecordStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface StoredCollectionForm {
  id: string;
  tenantId: TenantId;
  projectId: string;
  name: string;
  description?: string;
  definition: FormDefinition;
  mappings: RecordMapping[];
  status: CollectionFormStatus;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredCollectionRecord {
  id: string;
  tenantId: TenantId;
  formId: string;
  projectId: string;
  answers: Record<string, unknown>;
  /** A plain day (UTC). */
  submittedOn: string;
  source: "USER" | "LINK" | "CONNECTOR";
  submittedById?: string;
  submitterName?: string;
  status: CollectionRecordStatus;
  reviewNote?: string;
  reviewedById?: string;
  reviewedAt?: Date;
  createdAt: Date;
  /** Phase 62: the facility or place the record is about, and which visit it is for that place. */
  placeId?: string;
  visitNo?: number;
  /** 1 = flat answers; 2 = may hold grids, repeats and "not applicable". */
  answersVersion?: number;
  /** How answers were established by field key, the quality flags and the score worked out at submission. */
  how?: Record<string, string>;
  flags?: Array<{ code: string; detail: string }>;
  score?: { overall: number | null; band?: string; tone?: string; answered: number; total: number };
  startedAt?: Date;
}

export interface StoredCollectionLink {
  id: string;
  tenantId: TenantId;
  formId: string;
  label: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdById: string;
  createdAt: Date;
}

export interface ICollectionFormRepository {
  create(form: StoredCollectionForm): Promise<Result<void>>;
  /** Writes every mutable field (`?? null`), so a cleared description is cleared. */
  update(form: StoredCollectionForm): Promise<Result<void>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredCollectionForm | null>>;
  listByProject(projectId: string, tenantId: TenantId): Promise<Result<StoredCollectionForm[]>>;
  /** Removes a form only while it is still a draft (a published form keeps its records); true when a row was removed. */
  deleteDraft(id: string, tenantId: TenantId): Promise<Result<boolean>>;
}

export interface ICollectionRecordRepository {
  /** Idempotent by id: a second create with the same id returns the stored one and `created: false`. */
  createOnce(record: StoredCollectionRecord): Promise<Result<{ record: StoredCollectionRecord; created: boolean }>>;
  update(record: StoredCollectionRecord): Promise<Result<void>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredCollectionRecord | null>>;
  listByForm(formId: string, tenantId: TenantId, status?: CollectionRecordStatus): Promise<Result<StoredCollectionRecord[]>>;
  countByStatus(formId: string, tenantId: TenantId): Promise<Result<Record<CollectionRecordStatus, number>>>;
  /** Phase 62: every record of a form about one place, oldest first. */
  listByPlace(formId: string, placeId: string, tenantId: TenantId): Promise<Result<StoredCollectionRecord[]>>;
}

export type AssignmentState = "TO_DO" | "IN_PROGRESS" | "DONE" | "NOT_VISITED";

export interface StoredCollectionAssignment {
  id: string;
  tenantId: TenantId;
  formId: string;
  projectId: string;
  placeId: string;
  assigneeId: string;
  dueOn?: string;
  status: AssignmentState;
  reason?: string;
  recordId?: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

/** A facility given to an assessor for one form: at most one assignment per form and facility. */
export interface ICollectionAssignmentRepository {
  /** Creates each, or changes the assessor and due day of one that exists and is not done. */
  upsertMany(items: StoredCollectionAssignment[]): Promise<Result<void>>;
  update(item: StoredCollectionAssignment): Promise<Result<void>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredCollectionAssignment | null>>;
  findByFormAndPlace(formId: string, placeId: string, tenantId: TenantId): Promise<Result<StoredCollectionAssignment | null>>;
  listByForm(formId: string, tenantId: TenantId): Promise<Result<StoredCollectionAssignment[]>>;
  listForAssignee(assigneeId: string, tenantId: TenantId, statuses?: AssignmentState[]): Promise<Result<StoredCollectionAssignment[]>>;
}

export interface StoredCollectionDraft {
  id: string;
  tenantId: TenantId;
  formId: string;
  projectId: string;
  userId: string;
  /** "" when the form has no subject. */
  placeKey: string;
  answers: Record<string, unknown>;
  how?: Record<string, string>;
  startedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** A long form in progress: one per person, form and facility. Never counted, never reviewed. */
export interface ICollectionDraftRepository {
  find(formId: string, userId: string, placeKey: string, tenantId: TenantId): Promise<Result<StoredCollectionDraft | null>>;
  /** Writes the draft; the caller has already checked the version it started from. */
  save(draft: StoredCollectionDraft): Promise<Result<StoredCollectionDraft>>;
  delete(formId: string, userId: string, placeKey: string, tenantId: TenantId): Promise<Result<void>>;
  listForUser(userId: string, tenantId: TenantId): Promise<Result<StoredCollectionDraft[]>>;
  /** Drafts last saved before the day, for the expiry sweep. */
  listOlderThan(before: Date, tenantId: TenantId): Promise<Result<StoredCollectionDraft[]>>;
  deleteIds(ids: string[], tenantId: TenantId): Promise<Result<void>>;
}

export interface ICollectionLinkRepository {
  create(link: StoredCollectionLink): Promise<Result<void>>;
  listByForm(formId: string, tenantId: TenantId): Promise<Result<StoredCollectionLink[]>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredCollectionLink | null>>;
  revoke(id: string, tenantId: TenantId, at: Date): Promise<Result<void>>;
  /** Across organisations: the visitor does not belong to one yet; the token says which. Admin connection only. */
  findByTokenHash(tokenHash: string): Promise<Result<StoredCollectionLink | null>>;
}

export interface StoredCollectionFile {
  id: string;
  tenantId: TenantId;
  formId: string;
  fileName: string;
  contentType: string;
  size: number;
  storageKey: string;
  source: "USER" | "LINK";
  uploadedById?: string;
  createdAt: Date;
}

export interface ICollectionFileRepository {
  create(file: StoredCollectionFile): Promise<Result<void>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredCollectionFile | null>>;
}

export interface StoredDataConnector {
  id: string;
  tenantId: TenantId;
  formId: string;
  projectId: string;
  name: string;
  kind: "KOBOTOOLBOX" | "SURVEYCTO";
  serverUrl: string;
  sourceId: string;
  fieldMap: Array<{ sourceField: string; formKey: string }>;
  /** Encrypted; never leaves the server. */
  credentialEnc?: string;
  cursor?: string;
  lastSyncAt?: Date;
  lastSync?: Record<string, unknown>;
  createdById: string;
  createdAt: Date;
}

export interface IDataConnectorRepository {
  create(c: StoredDataConnector): Promise<Result<void>>;
  /** Writes every mutable field (`?? null`), so a cleared cursor is cleared. */
  update(c: StoredDataConnector): Promise<Result<void>>;
  delete(id: string, tenantId: TenantId): Promise<Result<void>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredDataConnector | null>>;
  listByForm(formId: string, tenantId: TenantId): Promise<Result<StoredDataConnector[]>>;
}

/** The API token or password of a connector, kept encrypted. Unavailable when the server has no key configured: nothing is then saved. */
export interface IConnectorSecrets {
  readonly available: boolean;
  encrypt(plain: string): string;
  decrypt(stored: string): string;
}

export type ConnectorFetch =
  | { ok: true; json: unknown }
  | { ok: false; reason: "UNREACHABLE" | "TIMEOUT" | "UNAUTHORIZED" | "NOT_FOUND" | "TOO_BIG" | "BAD_REPLY" | "UNSAFE_ADDRESS" | "SERVER_ERROR" };

/** Fetches one page from the other tool. The adapter refuses a private address, follows no redirect and limits time and size. */
export interface IConnectorHttp {
  get(url: string, headers: Record<string, string>): Promise<ConnectorFetch>;
}

/** Draws a finished assessment (Phase 62.9) from the document model the domain builds; nothing here decides what the document says. */
export interface IAssessmentFiles {
  pdf(doc: import("@donordesk/domain").AssessmentDocument): Promise<Buffer>;
  docx(doc: import("@donordesk/domain").AssessmentDocument, options: { rtl: boolean }): Promise<Buffer>;
  xlsx(doc: import("@donordesk/domain").AssessmentDocument): Promise<Buffer>;
}
