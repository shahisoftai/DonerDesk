import { blank } from "./answer-values.js";
import type { FormDefinition, FormField } from "./form-model.js";

/**
 * Every uploaded file a set of answers names, with the question it answers: a photo or document question, a drawn signature, a file column
 * of a table, and the same inside a repeat's rows. Used to check that each file was uploaded to this very form. Pure.
 */
export function collectFileIds(form: Pick<FormDefinition, "fields">, values: Readonly<Record<string, unknown>>): Array<{ key: string; label: string; id: string }> {
  const out: Array<{ key: string; label: string; id: string }> = [];
  const walk = (fields: ReadonlyArray<FormField>, answers: Readonly<Record<string, unknown>>, prefix: string): void => {
    for (const f of fields) {
      const v = answers[f.key];
      if (blank(v)) continue;
      if ((f.type === "FILE" || f.type === "SIGNATURE") && typeof v === "string") out.push({ key: prefix + f.key, label: f.label, id: v });
      else if (f.type === "GRID" && typeof v === "object" && !Array.isArray(v)) {
        for (const row of f.rows ?? []) for (const c of f.columns ?? []) {
          const cell = (v as Record<string, Record<string, unknown>>)[row.key]?.[c.key];
          if (c.type === "FILE" && typeof cell === "string") out.push({ key: `${prefix}${f.key}.${row.key}.${c.key}`, label: `${f.label}: ${row.label} — ${c.label}`, id: cell });
        }
      } else if (f.type === "REPEAT" && Array.isArray(v)) v.forEach((item, i) => { if (typeof item === "object" && item !== null) walk(f.fields ?? [], item as Record<string, unknown>, `${prefix}${f.key}[${i}].`); });
    }
  };
  walk(form.fields, values, "");
  return out;
}

/** True when a form can take an uploaded file at all (a photo, document, signature or a file column), so the upload route can refuse early. */
export function formTakesFiles(form: Pick<FormDefinition, "fields">): boolean {
  const has = (fields: ReadonlyArray<FormField>): boolean => fields.some((f) => f.type === "FILE" || f.type === "SIGNATURE" || (f.type === "GRID" && (f.columns ?? []).some((c) => c.type === "FILE")) || (f.type === "REPEAT" && has(f.fields ?? [])));
  return has(form.fields);
}
