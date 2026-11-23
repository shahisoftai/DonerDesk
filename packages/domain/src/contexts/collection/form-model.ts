import type { ScoreRules } from "./scoring.js";

/**
 * The shape of a collection form (Phase 33.5, extended by Phase 62). Types only: every behaviour that depends on a field's type lives in
 * one row of `FIELD_TYPE_DEFS` (`field-types/`), never in a `switch` over these names.
 */
export type FormFieldType =
  | "NUMBER" | "TEXT" | "DATE" | "SELECT" | "YES_NO" | "PLACE" | "GPS" | "FILE"
  | "MULTI_SELECT" | "SIGNATURE" | "SECTION" | "NOTE" | "REPEAT" | "GRID" | "CALCULATED";
export const FORM_FIELD_TYPES: readonly FormFieldType[] = [
  "NUMBER", "TEXT", "DATE", "SELECT", "YES_NO", "PLACE", "GPS", "FILE", "MULTI_SELECT", "SIGNATURE", "SECTION", "NOTE", "REPEAT", "GRID", "CALCULATED",
];

/** A photo, document or drawn signature is uploaded first; the answer is the id the upload returned. */
export const FILE_ID = /^[A-Za-z0-9_-]{8,64}$/;

export type ConditionOp = "EQ" | "NEQ" | "GT" | "GTE" | "LT" | "LTE" | "IN" | "FILLED" | "EMPTY" | "CONTAINS";

export interface ConditionLeaf {
  /** The key of an earlier field. */
  field: string;
  op: ConditionOp;
  /** The value to compare with (a list for IN); not used by FILLED / EMPTY. */
  value?: string | number | boolean | ReadonlyArray<string | number>;
}

export type Condition = ConditionLeaf | { all: ReadonlyArray<Condition> } | { any: ReadonlyArray<Condition> };

/** How an answer was established (the assessment tools ask for "observation and verification of records"). */
export type HowVerified = "OBSERVED" | "RECORD_CHECKED" | "REPORTED";
export const HOW_VERIFIED: readonly HowVerified[] = ["OBSERVED", "RECORD_CHECKED", "REPORTED"];

export type GridColumnType = "NUMBER" | "TEXT" | "SELECT" | "YES_NO" | "FILE";
export interface GridColumn {
  key: string;
  label: string;
  type: GridColumnType;
  required?: boolean;
  allowNotApplicable?: boolean;
  min?: number;
  max?: number;
  options?: ReadonlyArray<{ value: string; label: string }>;
  labels?: Readonly<Record<string, string>>;
}
export interface GridRow { key: string; label: string; labels?: Readonly<Record<string, string>> }

export interface FormField {
  /** Lower-case letters, digits and underscores; stable once records exist. */
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  /** Required only when this holds (ignored when the field is not shown). */
  requiredWhen?: Condition;
  /** The field is asked only when this holds; absent = always. A section that is not asked hides every field up to the next section. */
  relevantWhen?: Condition;
  min?: number;
  max?: number;
  maxLength?: number;
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** Instructions shown under the question, a section's introduction, or a note's text. */
  help?: string;
  /** The wording in other languages by code ("ur", "ps", "fr"…); the label is the fallback. */
  labels?: Readonly<Record<string, string>>;
  /** The instructions in other languages, by code. */
  helpLabels?: Readonly<Record<string, string>>;
  /** "Not applicable" is an answer of its own (never a gap, never 0). */
  allowNotApplicable?: boolean;
  /** The last visit's answer is offered again (static facts such as year established). */
  carryForward?: boolean;
  /** Ask how this answer was established, and (optionally) require a file when it was checked in records. */
  verify?: { evidenceField?: string; evidenceWhen?: ReadonlyArray<HowVerified> };
  /** REPEAT: the questions asked once for each row, and how many rows are allowed. */
  fields?: ReadonlyArray<FormField>;
  minRows?: number;
  maxRows?: number;
  rowLabel?: string;
  /** GRID: the rows and the typed columns. */
  rows?: ReadonlyArray<GridRow>;
  columns?: ReadonlyArray<GridColumn>;
  /** CALCULATED: an expression over earlier fields (see `calc-expression.ts`) and the decimals kept. */
  formula?: string;
  decimals?: number;
  /** SIGNATURE: who signs (for example "Medical Superintendent"). */
  signer?: string;
}

export type ConstraintKind = "LTE" | "GTE" | "SUM_EQUALS" | "ONE_OF_REQUIRED";
export interface FormConstraint {
  kind: ConstraintKind;
  /** LTE/GTE: [smaller, larger]; SUM_EQUALS: [total, ...parts]; ONE_OF_REQUIRED: the fields of which one must be filled. */
  fields: ReadonlyArray<string>;
  /** Shown instead of the standard sentence. */
  message?: string;
}

export type FormSubject = "FACILITY" | "PLACE" | "NONE";

export interface FormDefinition {
  fields: ReadonlyArray<FormField>;
  constraints?: ReadonlyArray<FormConstraint>;
  /** What one record is about: a facility (a place flagged as one), any place, or nothing in particular. Absent = NONE. */
  subject?: FormSubject;
  /** How answers become a score (see `scoring.ts`). */
  score?: ScoreRules;
  /** The language codes the form carries wording for, besides the default. */
  languages?: ReadonlyArray<string>;
}

export type Answers = Readonly<Record<string, unknown>>;

/** What kind of answer problem it is, so a screen can say it in the person's own language. Design-time problems have none. */
export type SubmissionProblemCode =
  | "REQUIRED" | "NUMBER" | "MIN" | "MAX" | "DATE" | "OPTION" | "YES_NO" | "GPS" | "TOO_LONG" | "FILE"
  | "ROWS_MIN" | "ROWS_MAX" | "CONSTRAINT" | "EVIDENCE" | "SHAPE";

export interface FormProblem {
  /** The field key (a path such as `blocks[2].name` inside a repeat), or "" for the form as a whole. */
  field: string;
  /** The English sentence (used by the server, the API and the tests). */
  message: string;
  /** For an answer problem: its kind, and the values the sentence needs (`label`, `min`, `max`). */
  code?: SubmissionProblemCode;
  params?: Record<string, string | number>;
}
