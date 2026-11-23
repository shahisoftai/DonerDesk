import { conditionShape, referencedFields } from "./conditions.js";
import { constraintDefinitionProblems } from "./constraints.js";
import { FIELD_TYPE_DEFS } from "./field-types/index.js";
import type { FormDefinition, FormField, FormProblem } from "./form-model.js";
import { FORM_FIELD_TYPES } from "./form-model.js";
import { FORM_LIMITS } from "./form-limits.js";
import { scoreRulesProblems } from "./scoring.js";

const KEY = /^[a-z][a-z0-9_]{0,39}$/;

/** The checks every field list shares (the form, a repeat's questions). `earlier` is what a condition or formula may name. */
function checkList(fields: ReadonlyArray<FormField>, earlierOutside: ReadonlySet<string>, insideRepeat: boolean, problems: FormProblem[]): Set<string> {
  const seen = new Set<string>();
  const earlier = new Set(earlierOutside);
  for (const f of fields) {
    if (!KEY.test(f.key)) problems.push({ field: f.key, message: `"${f.key}" is not a valid field key; use lower-case letters, digits and underscores, starting with a letter.` });
    else if (seen.has(f.key)) problems.push({ field: f.key, message: `The key "${f.key}" is used twice.` });
    if (!f.label.trim()) problems.push({ field: f.key, message: "Every field needs a label." });
    const def = FIELD_TYPE_DEFS[f.type];
    if (!FORM_FIELD_TYPES.includes(f.type) || !def) { problems.push({ field: f.key, message: `"${String(f.type)}" is not a field type.` }); seen.add(f.key); earlier.add(f.key); continue; }
    if (def.checkDefinition) {
      const ctx = {
        earlier, insideRepeat,
        checkChildren: (children: ReadonlyArray<FormField>, outside: ReadonlySet<string>) => {
          const inner: FormProblem[] = [];
          checkList(children, outside, true, inner);
          return inner.map((p) => (p.field ? `${f.key}.${p.field}: ${p.message}` : p.message));
        },
      };
      for (const message of def.checkDefinition(f, ctx)) problems.push({ field: f.key, message });
    }
    if (f.options && f.options.length > FORM_LIMITS.options) problems.push({ field: f.key, message: `A choice field can have at most ${FORM_LIMITS.options} options.` });
    if (!def.takesOptions && f.options && f.options.length > 0) problems.push({ field: f.key, message: "Only a choice field has options." });
    if (f.min !== undefined && f.max !== undefined && f.min > f.max) problems.push({ field: f.key, message: "The smallest allowed value is above the largest." });
    if ((f.min !== undefined || f.max !== undefined) && !def.takesRange) problems.push({ field: f.key, message: "Only a number field has a smallest or largest value." });
    for (const [name, c] of [["Shown when", f.relevantWhen], ["Required when", f.requiredWhen]] as const) {
      if (!c) continue;
      conditionShape(c, name, problems, f.key);
      for (const ref of referencedFields(c)) {
        if (ref === f.key) problems.push({ field: f.key, message: `${name}: a field cannot depend on itself.` });
        else if (!earlier.has(ref)) problems.push({ field: f.key, message: `${name}: "${ref}" must be an earlier field of the form.` });
      }
    }
    if (f.verify?.evidenceField) {
      const target = fields.find((x) => x.key === f.verify!.evidenceField);
      if (!target || target.type !== "FILE") problems.push({ field: f.key, message: `The evidence field "${f.verify.evidenceField}" must be a file question of the form.` });
    }
    seen.add(f.key);
    earlier.add(f.key);
  }
  return seen;
}

/** Problems that make a form unusable. A condition may only look at an earlier field, so a form can always be filled top to bottom. */
export function validateFormDefinition(form: FormDefinition): FormProblem[] {
  const problems: FormProblem[] = [];
  if (form.fields.length === 0) problems.push({ field: "", message: "A form needs at least one field." });
  if (form.fields.length > FORM_LIMITS.fields) problems.push({ field: "", message: `A form can have at most ${FORM_LIMITS.fields} fields; this one has ${form.fields.length}.` });
  const sections = form.fields.filter((f) => f.type === "SECTION").length;
  if (sections > FORM_LIMITS.sections) problems.push({ field: "", message: `A form can have at most ${FORM_LIMITS.sections} sections; this one has ${sections}.` });
  const keys = checkList(form.fields, new Set(), false, problems);
  if (form.constraints) {
    if (form.constraints.length > FORM_LIMITS.constraints) problems.push({ field: "", message: `A form can have at most ${FORM_LIMITS.constraints} rules.` });
    for (const message of constraintDefinitionProblems(form.constraints, keys)) problems.push({ field: "", message });
  }
  if (form.score) for (const message of scoreRulesProblems(form.score, keys)) problems.push({ field: "", message });
  if (form.subject !== undefined && !["FACILITY", "PLACE", "NONE"].includes(form.subject)) problems.push({ field: "", message: `"${String(form.subject)}" is not a subject.` });
  return problems;
}
