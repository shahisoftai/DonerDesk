import { checkConstraints } from "./constraints.js";
import { askedKeys, validateFieldList } from "./validate-fields.js";
import { FIELD_TYPE_DEFS } from "./field-types/index.js";
import { checkVerification } from "./verification.js";
import type { Answers, FormDefinition, FormField, FormProblem, HowVerified } from "./form-model.js";

/**
 * The form engine's public face (Phase 33.5, rebuilt on a table of field types in Phase 62). The web filler, the member route, the
 * public link, the offline sender and the server all call these same functions, so a rule is written once.
 */
export * from "./form-model.js";
export { conditionHolds } from "./conditions.js";
export { validateFormDefinition } from "./form-definition-check.js";

/** The fields that are asked for these answers, in form order. */
export function visibleFields(form: FormDefinition, answers: Answers): FormField[] {
  const shown = askedKeys(form.fields, answers);
  return form.fields.filter((f) => shown.has(f.key));
}

export interface SubmissionResult {
  /** The answers to keep: only asked fields, normalised (numbers as numbers, yes/no as booleans, a repeat as rows). */
  values: Record<string, unknown>;
  problems: FormProblem[];
  /** Answers given to fields that are not asked for these answers; they are not stored. */
  ignored: string[];
  /** How the answers that ask for it were established. */
  how: Record<string, HowVerified>;
}

export interface SubmissionOptions { how?: Readonly<Record<string, unknown>> }

/** Checks a submission against the form and returns what to store. Any problem means nothing should be stored. */
export function validateSubmission(form: FormDefinition, answers: Answers, options: SubmissionOptions = {}): SubmissionResult {
  const checked = validateFieldList(form.fields, answers, {}, "");
  const problems = [...checked.problems];
  // A rule is judged whenever every question it names was answered validly, even if other questions still have problems, so the person sees it at once.
  if (form.constraints?.length) {
    const labels = Object.fromEntries(form.fields.map((f) => [f.key, f.label]));
    const asked = askedKeys(form.fields, answers);
    problems.push(...checkConstraints(form.constraints, checked.values, labels, asked));
  }
  const verification = checkVerification(form, checked.values, options.how);
  problems.push(...verification.problems);
  return { values: checked.values, problems, ignored: checked.ignored, how: verification.how };
}

/** True for a type that takes an answer from a person (not a heading, a note or a computed value). */
export const takesAnswer = (f: FormField): boolean => FIELD_TYPE_DEFS[f.type].asks && !FIELD_TYPE_DEFS[f.type].computed;
