import { blank } from "./answer-values.js";
import { HOW_VERIFIED, type FormDefinition, type FormProblem, type HowVerified } from "./form-model.js";

/**
 * How an answer was established (Phase 62.9): observed, checked in records, or only reported. A field with `verify` takes the answer's
 * "how", and may require a file beside it when it was checked in records. The "how" is kept apart from the answers, so every report,
 * chart and sheet still reads plain answers.
 */
export function checkVerification(form: FormDefinition, values: Readonly<Record<string, unknown>>, how: Readonly<Record<string, unknown>> | undefined): { how: Record<string, HowVerified>; problems: FormProblem[] } {
  const problems: FormProblem[] = [];
  const kept: Record<string, HowVerified> = {};
  for (const [key, mode] of Object.entries(how ?? {})) {
    const field = form.fields.find((f) => f.key === key && f.verify);
    if (!field) problems.push({ field: key, message: `"${key}" does not ask how it was established.`, code: "SHAPE", params: { label: key } });
    else if (!HOW_VERIFIED.includes(mode as HowVerified)) problems.push({ field: key, message: `${field.label}: "${String(mode)}" is not a way an answer was established.`, code: "SHAPE", params: { label: field.label } });
    else if (!blank(values[key])) kept[key] = mode as HowVerified;
  }
  for (const f of form.fields) {
    const rule = f.verify;
    const mode = kept[f.key];
    if (!rule?.evidenceField || !mode || !(rule.evidenceWhen ?? []).includes(mode)) continue;
    if (blank(values[rule.evidenceField])) problems.push({ field: rule.evidenceField, message: `${f.label}: attach the evidence for an answer checked in records.`, code: "EVIDENCE", params: { label: f.label } });
  }
  return { how: kept, problems };
}
