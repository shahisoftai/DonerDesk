/**
 * The collection form rule engine (Phase 33.5): one set of rules shared by the web form, the public collection link and the API.
 * Pure; no clock, no I/O. A form is a list of fields; a field may be required, required only when another answer says so, or shown
 * only when another answer says so. Nothing a person typed is dropped silently: an answer to a field that is not shown is reported
 * as ignored, and an unknown field is a problem.
 */

export type FormFieldType = "NUMBER" | "TEXT" | "DATE" | "SELECT" | "YES_NO" | "PLACE" | "GPS" | "FILE";
export const FORM_FIELD_TYPES: readonly FormFieldType[] = ["NUMBER", "TEXT", "DATE", "SELECT", "YES_NO", "PLACE", "GPS", "FILE"];

/** A photo or document is uploaded first; the answer is the id the upload returned. */
export const FILE_ID = /^[A-Za-z0-9_-]{8,64}$/;

export type ConditionOp = "EQ" | "NEQ" | "GT" | "GTE" | "LT" | "LTE" | "IN" | "FILLED" | "EMPTY";

export interface ConditionLeaf {
  /** The key of an earlier field. */
  field: string;
  op: ConditionOp;
  /** The value to compare with (a list for IN); not used by FILLED / EMPTY. */
  value?: string | number | boolean | ReadonlyArray<string | number>;
}
export type Condition = ConditionLeaf | { all: ReadonlyArray<Condition> } | { any: ReadonlyArray<Condition> };

export interface FormField {
  /** Lower-case letters, digits and underscores; stable once records exist. */
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  /** Required only when this holds (ignored when the field is not shown). */
  requiredWhen?: Condition;
  /** The field is asked only when this holds; absent = always. */
  relevantWhen?: Condition;
  min?: number;
  max?: number;
  maxLength?: number;
  options?: ReadonlyArray<{ value: string; label: string }>;
}

export interface FormDefinition {
  fields: ReadonlyArray<FormField>;
}

export type Answers = Readonly<Record<string, unknown>>;

/** What kind of answer problem it is, so a screen can say it in the person's own language. Design-time problems have none. */
export type SubmissionProblemCode = "REQUIRED" | "NUMBER" | "MIN" | "MAX" | "DATE" | "OPTION" | "YES_NO" | "GPS" | "TOO_LONG" | "FILE";

export interface FormProblem {
  /** The field key, or "" for the form as a whole. */
  field: string;
  /** The English sentence (used by the server, the API and the tests). */
  message: string;
  /** For an answer problem: its kind, and the values the sentence needs (`label`, `min`, `max`). */
  code?: SubmissionProblemCode;
  params?: Record<string, string | number>;
}

const KEY = /^[a-z][a-z0-9_]{0,39}$/;
const OPS: readonly ConditionOp[] = ["EQ", "NEQ", "GT", "GTE", "LT", "LTE", "IN", "FILLED", "EMPTY"];

const isLeaf = (c: Condition): c is ConditionLeaf => "field" in c;

function referencedFields(c: Condition, out: string[] = []): string[] {
  if (isLeaf(c)) out.push(c.field);
  else for (const child of "all" in c ? c.all : c.any) referencedFields(child, out);
  return out;
}

function conditionShape(c: Condition, label: string, problems: FormProblem[], field: string): void {
  if (isLeaf(c)) {
    if (!OPS.includes(c.op)) problems.push({ field, message: `${label}: "${String(c.op)}" is not a known comparison.` });
    else if (c.op !== "FILLED" && c.op !== "EMPTY" && c.value === undefined) problems.push({ field, message: `${label}: a comparison needs a value.` });
    else if (c.op === "IN" && !Array.isArray(c.value)) problems.push({ field, message: `${label}: "is one of" needs a list of values.` });
    return;
  }
  const children = "all" in c ? c.all : c.any;
  if (children.length === 0) problems.push({ field, message: `${label}: a group of conditions cannot be empty.` });
  for (const child of children) conditionShape(child, label, problems, field);
}

/** Problems that make a form unusable. A condition may only look at an earlier field, so a form can always be filled top to bottom. */
export function validateFormDefinition(form: FormDefinition): FormProblem[] {
  const problems: FormProblem[] = [];
  if (form.fields.length === 0) problems.push({ field: "", message: "A form needs at least one field." });
  const seen = new Set<string>();
  for (const f of form.fields) {
    if (!KEY.test(f.key)) problems.push({ field: f.key, message: `"${f.key}" is not a valid field key; use lower-case letters, digits and underscores, starting with a letter.` });
    else if (seen.has(f.key)) problems.push({ field: f.key, message: `The key "${f.key}" is used twice.` });
    if (!f.label.trim()) problems.push({ field: f.key, message: "Every field needs a label." });
    if (!FORM_FIELD_TYPES.includes(f.type)) problems.push({ field: f.key, message: `"${String(f.type)}" is not a field type.` });
    if (f.type === "SELECT") {
      const values = (f.options ?? []).map((o) => o.value);
      if (values.length < 2) problems.push({ field: f.key, message: "A choice field needs at least two options." });
      if (new Set(values).size !== values.length) problems.push({ field: f.key, message: "Two options have the same value." });
    } else if (f.options && f.options.length > 0) problems.push({ field: f.key, message: "Only a choice field has options." });
    if (f.min !== undefined && f.max !== undefined && f.min > f.max) problems.push({ field: f.key, message: "The smallest allowed value is above the largest." });
    if ((f.min !== undefined || f.max !== undefined) && f.type !== "NUMBER") problems.push({ field: f.key, message: "Only a number field has a smallest or largest value." });
    for (const [name, c] of [["Shown when", f.relevantWhen], ["Required when", f.requiredWhen]] as const) {
      if (!c) continue;
      conditionShape(c, name, problems, f.key);
      for (const ref of referencedFields(c)) {
        if (ref === f.key) problems.push({ field: f.key, message: `${name}: a field cannot depend on itself.` });
        else if (!seen.has(ref)) problems.push({ field: f.key, message: `${name}: "${ref}" must be an earlier field of the form.` });
      }
    }
    seen.add(f.key);
  }
  return problems;
}

const blank = (v: unknown): boolean => v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

const asNumber = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const comparable = (v: unknown): number | string | null => {
  if (blank(v)) return null;
  const n = asNumber(v);
  if (n !== null) return n;
  // Yes/No answers compare as "yes" / "no" whether they arrive as booleans (the API) or words (a form).
  if (typeof v === "boolean") return v ? "yes" : "no";
  const t = String(v).trim().toLowerCase();
  return t === "true" ? "yes" : t === "false" ? "no" : t;
};

/** Does the condition hold for these answers? An unanswered field never satisfies a comparison (only EMPTY / NEQ say so). */
export function conditionHolds(c: Condition, answers: Answers): boolean {
  if (!isLeaf(c)) return "all" in c ? c.all.every((x) => conditionHolds(x, answers)) : c.any.some((x) => conditionHolds(x, answers));
  const actual = comparable(answers[c.field]);
  if (c.op === "FILLED") return actual !== null;
  if (c.op === "EMPTY") return actual === null;
  const expected = Array.isArray(c.value) ? (c.value as ReadonlyArray<string | number>).map(comparable) : comparable(c.value);
  if (c.op === "NEQ") return actual === null ? true : actual !== expected;
  if (actual === null) return false;
  switch (c.op) {
    case "EQ": return actual === expected;
    case "IN": return Array.isArray(expected) && expected.includes(actual);
    case "GT": case "GTE": case "LT": case "LTE": {
      if (typeof actual !== "number" || typeof expected !== "number") return false;
      return c.op === "GT" ? actual > expected : c.op === "GTE" ? actual >= expected : c.op === "LT" ? actual < expected : actual <= expected;
    }
    default: return false;
  }
}

/** The fields that are asked for these answers, in form order. */
export function visibleFields(form: FormDefinition, answers: Answers): FormField[] {
  return form.fields.filter((f) => !f.relevantWhen || conditionHolds(f.relevantWhen, answers));
}

const isRealDate = (text: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
};

export interface SubmissionResult {
  /** The answers to keep: only shown fields, normalised (numbers as numbers, yes/no as booleans). */
  values: Record<string, string | number | boolean | { lat: number; lon: number }>;
  problems: FormProblem[];
  /** Answers given to fields that are not asked for these answers; they are not stored. */
  ignored: string[];
}

/** Checks a submission against the form and returns what to store. Any problem means nothing should be stored. */
export function validateSubmission(form: FormDefinition, answers: Answers): SubmissionResult {
  const values: SubmissionResult["values"] = {};
  const problems: FormProblem[] = [];
  const known = new Set(form.fields.map((f) => f.key));
  for (const key of Object.keys(answers)) if (!known.has(key)) problems.push({ field: key, message: `"${key}" is not a field of this form.` });
  const shown = new Set(visibleFields(form, answers).map((f) => f.key));
  const ignored = form.fields.filter((f) => !shown.has(f.key) && !blank(answers[f.key])).map((f) => f.key);

  for (const f of form.fields) {
    if (!shown.has(f.key)) continue;
    const raw = answers[f.key];
    const required = f.required === true || (f.requiredWhen !== undefined && conditionHolds(f.requiredWhen, answers));
    if (blank(raw)) {
      if (required) problems.push({ field: f.key, message: `${f.label} is required.`, code: "REQUIRED", params: { label: f.label } });
      continue;
    }
    switch (f.type) {
      case "NUMBER": {
        const n = asNumber(raw);
        if (n === null) problems.push({ field: f.key, message: `${f.label} must be a number.`, code: "NUMBER", params: { label: f.label } });
        else if (f.min !== undefined && n < f.min) problems.push({ field: f.key, message: `${f.label} cannot be below ${f.min}.`, code: "MIN", params: { label: f.label, min: f.min } });
        else if (f.max !== undefined && n > f.max) problems.push({ field: f.key, message: `${f.label} cannot be above ${f.max}.`, code: "MAX", params: { label: f.label, max: f.max } });
        else values[f.key] = n;
        break;
      }
      case "DATE": {
        const t = String(raw).trim();
        if (!isRealDate(t)) problems.push({ field: f.key, message: `${f.label} must be a real date written as YYYY-MM-DD.`, code: "DATE", params: { label: f.label } });
        else values[f.key] = t;
        break;
      }
      case "SELECT": {
        const t = String(raw).trim();
        if (!(f.options ?? []).some((o) => o.value === t)) problems.push({ field: f.key, message: `${f.label}: "${t}" is not one of the options.`, code: "OPTION", params: { label: f.label } });
        else values[f.key] = t;
        break;
      }
      case "YES_NO": {
        const t = String(raw).trim().toLowerCase();
        if (raw === true || ["yes", "y", "true", "1"].includes(t)) values[f.key] = true;
        else if (raw === false || ["no", "n", "false", "0"].includes(t)) values[f.key] = false;
        else problems.push({ field: f.key, message: `${f.label} should be Yes or No.`, code: "YES_NO", params: { label: f.label } });
        break;
      }
      case "GPS": {
        const g = raw as { lat?: unknown; lon?: unknown };
        const lat = asNumber(g?.lat);
        const lon = asNumber(g?.lon);
        if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) problems.push({ field: f.key, message: `${f.label} must be a latitude (−90 to 90) and a longitude (−180 to 180).`, code: "GPS", params: { label: f.label } });
        else values[f.key] = { lat, lon };
        break;
      }
      case "FILE": {
        const t = String(raw).trim();
        if (!FILE_ID.test(t)) problems.push({ field: f.key, message: `${f.label}: attach a photo or document first.`, code: "FILE", params: { label: f.label } });
        else values[f.key] = t;
        break;
      }
      case "TEXT":
      case "PLACE": {
        const t = String(raw).trim();
        const limit = f.maxLength ?? 2000;
        if (t.length > limit) problems.push({ field: f.key, message: `${f.label} is longer than ${limit} characters.`, code: "TOO_LONG", params: { label: f.label, max: limit } });
        else values[f.key] = t;
        break;
      }
    }
  }
  return { values, problems, ignored };
}
