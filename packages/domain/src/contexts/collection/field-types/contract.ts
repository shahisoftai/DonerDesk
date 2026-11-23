import type { Answers, FormField, FormProblem } from "../form-model.js";

/** What a field type's validator may use: where it is (for problem paths), what conditions see, and the engine's own recursion. */
export interface FieldCtx {
  /** Prefix for problem paths inside a repeat, for example `blocks[1].`. */
  readonly prefix: string;
  /** The answers conditions and formulas see: the top level, plus the row being checked inside a repeat. */
  readonly scope: Answers;
  /** Checks a list of fields against one object of answers (a repeat row) and returns what to keep. */
  validateList(fields: ReadonlyArray<FormField>, answers: Answers, prefix: string): { values: Record<string, unknown>; problems: FormProblem[] };
  /** Checks one value against one field definition (a grid cell is a small field). */
  validateOne(field: FormField, raw: unknown, prefix: string): FieldOutcome;
  /** Reads the answers a path names for a formula, from the normalised values so far. */
  read(path: string): unknown[];
}

export interface FieldOutcome { value?: unknown; problems: FormProblem[] }

/** What a field definition's check may know: the keys a condition or a formula may name, and whether it sits inside a repeat. */
export interface DefinitionCtx {
  /** Keys of the fields before this one (top level, or earlier siblings plus the top level inside a repeat). */
  readonly earlier: ReadonlySet<string>;
  readonly insideRepeat: boolean;
  /** Runs the shared per-field checks on a child list (repeat) and returns its problem sentences. */
  checkChildren(fields: ReadonlyArray<FormField>, earlier: ReadonlySet<string>): string[];
}

/**
 * Everything that differs between field types, in one row each. The engine never asks "is this a repeat?": it asks the row. Adding a
 * type is a row here, a line in the contract enum and a component in the filler.
 */
export interface FieldTypeDef {
  /** Takes an answer from the person (false for section headings and notes). */
  readonly asks: boolean;
  /** The server works the answer out; one sent by a client is ignored. */
  readonly computed?: boolean;
  /** May carry `options`. */
  readonly takesOptions?: boolean;
  /** May carry `min` / `max`. */
  readonly takesRange?: boolean;
  /** An empty answer is still a problem (a repeat that must have rows). */
  requiredByShape?(field: FormField): boolean;
  validate(field: FormField, raw: unknown, ctx: FieldCtx): FieldOutcome;
  /** Problems with the definition itself, as plain sentences. */
  checkDefinition?(field: FormField, ctx: DefinitionCtx): string[];
}

export const ok = (value: unknown): FieldOutcome => ({ value, problems: [] });
export const bad = (field: string, message: string, code: NonNullable<FormProblem["code"]>, params: FormProblem["params"] = {}): FieldOutcome => ({ problems: [{ field, message, code, params }] });
