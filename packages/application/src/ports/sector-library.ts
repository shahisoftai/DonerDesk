import type { OrgEntryKind, Result, TenantId } from "@donordesk/domain";

export interface OrganisationLibraryRecord {
  entryId: string;
  kind: OrgEntryKind;
  payload: unknown;
  libraryVersion: number | null;
  updatedById: string;
  updatedAt: Date;
}

/** An organisation's own additions, rewordings, hidden entries and review decisions. Every call is scoped to the organisation. */
export interface IOrganisationLibraryStore {
  list(tenantId: TenantId): Promise<Result<OrganisationLibraryRecord[]>>;
  upsert(tenantId: TenantId, record: Omit<OrganisationLibraryRecord, "updatedAt">): Promise<Result<void>>;
  remove(tenantId: TenantId, entryId: string, kind: OrgEntryKind): Promise<Result<void>>;
}
