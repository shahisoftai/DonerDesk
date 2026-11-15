import type { AuthenticatedContext } from "../context.js";
import type { AreaDependents, IndicatorPlaceSetting, PlaceLinkRecord, PlaceLinkSource, PlaceRecord, RecordPlaceKind, Result, TenantId } from "@donordesk/domain";

/** A project's footprint row as stored (Phase 56). */
export interface StoredProjectArea {
  id: string;
  tenantId: string;
  projectId: string;
  placeId: string;
  closedAt: Date | null;
  closedReason: string | null;
  createdById: string;
  createdAt: Date;
}

export interface IProjectAreaRepository {
  list(tenantId: TenantId, projectId: string): Promise<Result<StoredProjectArea[]>>;
  /** Every project's areas in one read (the organisation's map). */
  listAll(tenantId: TenantId): Promise<Result<StoredProjectArea[]>>;
  /** Adds the area and removes the finer areas it covers, in one transaction. */
  add(area: StoredProjectArea, replaces: readonly string[]): Promise<Result<void>>;
  remove(tenantId: TenantId, projectId: string, placeId: string): Promise<Result<void>>;
  /** Writes `closedAt`/`closedReason` with `?? null` so reopening clears them. */
  update(area: StoredProjectArea): Promise<Result<void>>;
}

/** One stored link of a record to a place. */
export interface RecordPlaceRow extends PlaceLinkRecord {
  recordId: string;
}

/** The links of every kind (planned activity, completed activity, file, person) behind one port; the table is chosen by kind. */
export interface IRecordPlaceRepository {
  find(kind: RecordPlaceKind, recordId: string, tenantId: TenantId): Promise<Result<PlaceLinkRecord[]>>;
  findFor(kind: RecordPlaceKind, recordIds: readonly string[], tenantId: TenantId): Promise<Result<Map<string, PlaceLinkRecord[]>>>;
  /** Every link of one kind in a project (or the whole organisation when `projectId` is omitted), with its project. */
  listByProject(kind: RecordPlaceKind, tenantId: TenantId, projectId?: string): Promise<Result<Array<RecordPlaceRow & { projectId: string }>>>;
  /** Replaces a record's places, keeping the order given. */
  replace(kind: RecordPlaceKind, input: { tenantId: string; projectId: string; recordId: string; links: readonly PlaceLinkRecord[]; userId: string; now: Date }): Promise<Result<void>>;
  /** Adds one link unless it exists (confirming a typed word); never removes. */
  addIfMissing(kind: RecordPlaceKind, input: { tenantId: string; projectId: string; recordId: string; placeId: string; source: PlaceLinkSource; userId: string; now: Date }): Promise<Result<boolean>>;
}

/** What a record of a kind is: its project and the parent record it inherits places from. */
export interface RecordPlaceOwner {
  projectId: string;
  /** The parent record (planned activity of an activity, activity of a file or person), when there is one. */
  parentId: string | null;
  /** The typed location, kept as written. */
  typed: string | null;
}

export interface IRecordPlaceOwnerReader {
  ownerOf(kind: RecordPlaceKind, recordId: string, tenantId: TenantId): Promise<Result<RecordPlaceOwner | null>>;
}

/** A typed location word in a project's records, with the record that carries it. */
export interface TypedLocation {
  kind: RecordPlaceKind | "INDICATOR_VALUE";
  recordId: string;
  text: string;
}

export interface IProjectTypedLocations {
  /** Every typed location in one project's records (plan items, completed activities, people reached, by-place indicator entries without a place id). */
  typedIn(tenantId: TenantId, projectId: string): Promise<Result<TypedLocation[]>>;
  /** Gives by-place indicator entries of the project whose name normalises to `word` (and have no id yet) the place's id. Returns how many were changed. */
  linkIndicatorEntries(tenantId: TenantId, projectId: string, word: string, placeId: string, normalize: (text: string) => string): Promise<Result<number>>;
}

export interface StoredPlaceWordLink {
  id: string;
  tenantId: string;
  projectId: string;
  word: string;
  placeId: string;
  confirmedById: string;
  confirmedAt: Date;
}

export interface IPlaceWordLinkRepository {
  list(tenantId: TenantId, projectId: string): Promise<Result<StoredPlaceWordLink[]>>;
  /** Insert or move the word to another place. */
  upsert(link: StoredPlaceWordLink): Promise<Result<void>>;
}

/** How many of a project's records sit in a set of places (an area and everything inside it). */
export interface IAreaDependentsReader {
  count(tenantId: TenantId, projectId: string, placeIds: ReadonlySet<string>): Promise<Result<AreaDependents>>;
}

/** One merge, applied in one transaction: every link, word, area and indicator entry moves to the survivor. */
export interface IPlaceMergeWriter {
  merge(tenantId: TenantId, input: { keepAfter: PlaceRecord; mergedId: string; reparent: readonly string[]; now: Date }): Promise<Result<{ moved: number }>>;
}

/** The indicator fields this module reads and writes; the logframe repository implements it. */
export interface IndicatorPlaceRecord {
  id: string;
  projectId: string;
  title: string;
  calculated: boolean;
  placeScope: string;
  placeLevel: number | null;
  placeIds: string[];
  recordByPlace: boolean;
}

export interface IIndicatorPlaceStore {
  find(tenantId: string, indicatorId: string): Promise<Result<IndicatorPlaceRecord | null>>;
  /** Writes scope, level, ids and `recordByPlace` (kept in step: true for LEVEL and CHOSEN) with `?? null`. */
  save(tenantId: string, indicatorId: string, setting: IndicatorPlaceSetting): Promise<Result<void>>;
  /** Place ids the indicator's stored LOCATION entries name (or name-only categories, resolved by the caller). */
  locationEntries(tenantId: string, indicatorId: string): Promise<Result<Array<{ category: string; placeId?: string }>>>;
}


/** Called by a record's create handler (Phase 56): stores the places chosen in the form, or copies the parent's. Never fails the create. */
export interface IRecordPlacesAfterCreate {
  afterCreate(ctx: AuthenticatedContext, input: { kind: RecordPlaceKind; projectId: string; recordId: string; parentId: string | null; placeIds?: readonly string[] }): Promise<void>;
}
