import { blank, isNotApplicable, resolvePath } from "./answer-values.js";
import { conditionHolds } from "./conditions.js";
import { FIELD_TYPE_DEFS, type FieldCtx } from "./field-types/index.js";
import type { Answers, FormField, FormProblem } from "./form-model.js";

export interface ListResult {
  /** The answers to keep: only asked fields, normalised. */
  values: Record<string, unknown>;
  problems: FormProblem[];
  /** Answers given to fields that are not asked for these answers; they are not stored. */
  ignored: string[];
}

/**
 * Which fields of a list are asked for these answers, in order. A condition sees the answers; a section that is not asked takes every
 * field up to the next section with it.
 */
export function askedKeys(fields: ReadonlyArray<FormField>, answers: Answers): Set<string> {
  const shown = new Set<string>();
  let sectionHidden = false;
  for (const f of fields) {
    const holds = !f.relevantWhen || conditionHolds(f.relevantWhen, answers);
    if (f.type === "SECTION") { sectionHidden = !holds; if (holds) shown.add(f.key); continue; }
    if (!sectionHidden && holds) shown.add(f.key);
  }
  return shown;
}

/** Checks a list of fields against one object of answers (the whole form, or one repeat row) and returns what to keep. */
export function validateFieldList(fields: ReadonlyArray<FormField>, answers: Answers, scope: Answers, prefix: string): ListResult {
  const values: Record<string, unknown> = {};
  const problems: FormProblem[] = [];
  const asking = fields.filter((f) => FIELD_TYPE_DEFS[f.type].asks);
  const known = new Set(asking.map((f) => f.key));
  for (const key of Object.keys(answers)) if (!known.has(key)) problems.push({ field: prefix + key, message: `"${key}" is not a field of this form.` });
  const context: Answers = { ...scope, ...answers };
  const shown = askedKeys(fields, context);
  const ignored = asking.filter((f) => !shown.has(f.key) && !FIELD_TYPE_DEFS[f.type].computed && !blank(answers[f.key])).map((f) => prefix + f.key);

  const ctx: FieldCtx = {
    prefix, scope: context,
    validateList: (list, row, p) => validateFieldList(list, row, context, p),
    validateOne: (field, raw, p) => FIELD_TYPE_DEFS[field.type].validate(field, raw, { ...ctx, prefix: p }),
    read: (path) => resolvePath({ ...context, ...values }, path).map((n) => n.value),
  };

  for (const f of asking) {
    if (!shown.has(f.key)) continue;
    const def = FIELD_TYPE_DEFS[f.type];
    const raw = answers[f.key];
    if (def.computed) {
      const outcome = def.validate(f, raw, ctx);
      if (outcome.value !== undefined) values[f.key] = outcome.value;
      continue;
    }
    const required = f.required === true || def.requiredByShape?.(f) === true || (f.requiredWhen !== undefined && conditionHolds(f.requiredWhen, context));
    if (isNotApplicable(raw)) {
      if (f.allowNotApplicable) values[f.key] = { na: true, ...(typeof raw.reason === "string" && raw.reason.trim() ? { reason: raw.reason.trim() } : {}) };
      else problems.push({ field: prefix + f.key, message: `${f.label} cannot be marked not applicable.`, code: "SHAPE", params: { label: f.label } });
      continue;
    }
    if (blank(raw)) {
      if (required) problems.push({ field: prefix + f.key, message: `${f.label} is required.`, code: "REQUIRED", params: { label: f.label } });
      continue;
    }
    const outcome = def.validate(f, raw, ctx);
    problems.push(...outcome.problems);
    if (outcome.problems.length === 0 && outcome.value !== undefined) values[f.key] = outcome.value;
  }
  return { values, problems, ignored };
}
