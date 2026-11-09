import type { Permission } from "../../policies/permissions.js";

/**
 * The Visual Studio's data catalogue (Phase 48.17). Every visual asks for figures through one list of sources; a source names its
 * fields, how it joins to other sources and who may read it. Nothing here reads data: it describes what can be asked, so the Studio's
 * Data panel, the query validator and the recommender all work from one table.
 */
export const FIELD_ROLES = ["DIMENSION", "MEASURE"] as const;
export type FieldRole = (typeof FIELD_ROLES)[number];

export const FIELD_TYPES = ["TEXT", "COUNT", "AMOUNT", "RATE", "DATE", "STATUS", "PLACE", "FLAG"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** The things a source can be joined on. A query may only group or filter across a join both sources declare. */
export const JOIN_KEYS = ["PROJECT", "PERIOD", "PLACE", "INDICATOR", "LOGFRAME_NODE", "SECTOR", "DONOR", "GRANT", "PERSON", "CURRENCY"] as const;
export type JoinKey = (typeof JOIN_KEYS)[number];

export interface FieldDef {
  id: string;
  label: string;
  /** One plain sentence: what the field means. */
  meaning: string;
  role: FieldRole;
  type: FieldType;
  /** Unit shown beside the figure ("people", "currency of the line"); empty for text and dates. */
  unit?: string;
  /** A measure that may be summed across rows. A rate or an average never is, and amounts only within one currency. */
  additive?: boolean;
  /** An amount: summed and compared only inside one currency. */
  money?: boolean;
  /** The join this dimension provides (a dimension named PERIOD can be used to group by period). */
  joinKey?: JoinKey;
}

export interface DataSourceDef {
  id: string;
  label: string;
  description: string;
  /** What one row is ("an indicator value in a period"). */
  grain: string;
  /** The permission that opens the source; finer rules (confidentiality, project visibility) are applied by the reader. */
  permission: Permission;
  /** Whether an outside guest on a share link may see it (the share-link rule: the plan and results by place, never money or lists). */
  guest: boolean;
  /** Where the figures come from today: the reader that answers it (documentation, checked by a test against the registry). */
  reader: string;
  joins: readonly JoinKey[];
  fields: readonly FieldDef[];
}
