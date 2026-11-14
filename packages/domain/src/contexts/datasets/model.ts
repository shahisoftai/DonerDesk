/**
 * Datasets (Phase 54): a table a person brings (an upload, a connector pull, a form's records) and uses for visuals. Types only.
 * A dataset holds figures, not people (§8.2), and is never stored as indicator values: only an explicit link writes drafts (§3.9).
 * Nothing here names a sector: what differs between sectors lives in kit data files (`kits/data/*`).
 */
import type { ColumnKindKey } from "./column-kinds.js";
import type { SemanticKey } from "./semantics.js";

export type CellValue = string | number | boolean | null;

/** A raw table as read from a file or a pull: headers and rows of cells, nothing interpreted yet. */
export interface RawTable {
  headers: string[];
  rows: CellValue[][];
}

/** The parts a rate is worked out from, so it can be recomputed as a ratio of sums (never averaged). */
export interface RateParts { numerator: string; denominator: string; percent: boolean }

export interface ColumnDef {
  /** Stable, generated once; survives renames. */
  key: string;
  label: string;
  /** Header in the uploaded file, used to map the next upload. */
  sourceHeader: string;
  kind: ColumnKindKey;
  semantic: SemanticKey;
  unit?: string | undefined;
  hideOnShareLinks: boolean;
  rateParts?: RateParts | undefined;
  /** The kit role this column fills, when the dataset uses a kit. */
  role?: string | undefined;
}

/** One stored row: typed values keyed by column key, plus the place and period resolved at save time. */
export interface DatasetRowValues {
  rowNo: number;
  values: Record<string, CellValue>;
  placeId?: string | undefined;
  periodKey?: string | undefined;
}

export const DATASET_SCOPES = ["PROJECT", "ORGANISATION"] as const;
export type DatasetScope = (typeof DATASET_SCOPES)[number];

export const VERSION_STATUSES = ["PENDING", "ACCEPTED", "REJECTED"] as const;
export type VersionStatus = (typeof VERSION_STATUSES)[number];

/** Why an organisation keeps person-level rows (§8.2). Required when a dataset is restricted. */
export const LAWFUL_BASES = ["CONSENT", "LEGAL_DUTY", "VITAL_INTEREST", "PUBLIC_TASK", "CONTRACT", "LEGITIMATE_INTEREST"] as const;
export type LawfulBasis = (typeof LAWFUL_BASES)[number];

export interface Restriction {
  lawfulBasis: LawfulBasis;
  purpose: string;
  /** Plain day YYYY-MM-DD. */
  retainUntil: string;
  viewerIds: string[];
}

export interface SharePolicy {
  /** Column keys never shown on a share link, on top of the ones the column's semantic or kind already hides. */
  hidden: string[];
}

/** A figure worked out from columns and kept with the dataset (reusable across visuals). Same shape as a visual's calculated field. */
export interface DatasetFigure {
  id: string;
  label: string;
  op: "RATIO" | "SUM" | "DIFFERENCE" | "SHARE";
  terms: string[];
  percent?: boolean | undefined;
}

export interface DatasetSummary {
  id: string;
  name: string;
  description: string;
  scope: DatasetScope;
  projectId?: string | undefined;
  kitKey?: string | undefined;
  restricted: boolean;
}
