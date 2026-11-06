import type { PlaceRecord, Result, TenantId } from "@donordesk/domain";

/** A place as stored: the domain record plus who made it and whether it was retired. */
export interface StoredPlace extends PlaceRecord {
  tenantId: TenantId;
  createdById: string;
  archivedAt?: Date;
}

export interface IPlaceRepository {
  list(tenantId: TenantId, options?: { includeArchived?: boolean }): Promise<Result<StoredPlace[]>>;
  findById(id: string, tenantId: TenantId): Promise<Result<StoredPlace | null>>;
  /** One statement: a sheet of places is created all or not at all. */
  createMany(places: StoredPlace[]): Promise<Result<void>>;
  update(place: StoredPlace): Promise<Result<void>>;
}

/** Where location words appear in the organisation's records, with how often. Read-only. */
export interface LocationUsage {
  text: string;
  /** Where it was typed: a plan item, a completed activity, an indicator breakdown, a beneficiary. */
  sources: Array<"PLAN" | "ACTIVITY" | "INDICATOR" | "BENEFICIARY">;
  count: number;
}

export interface IPlaceUsageReader {
  distinctLocations(tenantId: TenantId): Promise<Result<LocationUsage[]>>;
}
