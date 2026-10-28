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
  source: "USER" | "LINK";
  submittedById?: string;
  submitterName?: string;
  status: CollectionRecordStatus;
  reviewNote?: string;
  reviewedById?: string;
  reviewedAt?: Date;
  createdAt: Date;
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
}

export interface ICollectionRecordRepository {
  /** Idempotent by id: a second create with the same id returns the stored one and `created: false`. */
  createOnce(record: StoredCollectionRecord): Promise<Result<{ record: StoredCollectionRecord; created: boolean }>>;
  update(record: StoredCollectionRecord): Promise<Result<void>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredCollectionRecord | null>>;
  listByForm(formId: string, tenantId: TenantId, status?: CollectionRecordStatus): Promise<Result<StoredCollectionRecord[]>>;
  countByStatus(formId: string, tenantId: TenantId): Promise<Result<Record<CollectionRecordStatus, number>>>;
}

export interface ICollectionLinkRepository {
  create(link: StoredCollectionLink): Promise<Result<void>>;
  listByForm(formId: string, tenantId: TenantId): Promise<Result<StoredCollectionLink[]>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredCollectionLink | null>>;
  revoke(id: string, tenantId: TenantId, at: Date): Promise<Result<void>>;
  /** Across organisations: the visitor does not belong to one yet; the token says which. Admin connection only. */
  findByTokenHash(tokenHash: string): Promise<Result<StoredCollectionLink | null>>;
}
