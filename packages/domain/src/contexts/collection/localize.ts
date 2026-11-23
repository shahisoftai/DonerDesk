import type { FormDefinition, FormField, GridColumn, GridRow } from "./form-model.js";

/**
 * A form in the assessor's language (Phase 62.10, anticipated gap A12). Every label, row and column may carry wording by language code;
 * the default label is the fallback, so a form half translated still reads. Keys and answers never change: only what is shown.
 */
const pick = (labels: Readonly<Record<string, string>> | undefined, lang: string | undefined, fallback: string): string => {
  if (!lang || !labels) return fallback;
  const text = labels[lang];
  return typeof text === "string" && text.trim() ? text : fallback;
};

const col = (c: GridColumn, lang: string | undefined): GridColumn => ({ ...c, label: pick(c.labels, lang, c.label) });
const row = (r: GridRow, lang: string | undefined): GridRow => ({ ...r, label: pick(r.labels, lang, r.label) });

export function localizeField(f: FormField, lang: string | undefined): FormField {
  return {
    ...f,
    label: pick(f.labels, lang, f.label),
    ...(f.help !== undefined ? { help: pick(f.helpLabels, lang, f.help) } : {}),
    ...(f.fields ? { fields: f.fields.map((c) => localizeField(c, lang)) } : {}),
    ...(f.rows ? { rows: f.rows.map((r) => row(r, lang)) } : {}),
    ...(f.columns ? { columns: f.columns.map((c) => col(c, lang)) } : {}),
  };
}

export const localizeForm = (form: FormDefinition, lang: string | undefined): FormDefinition => (!lang ? form : { ...form, fields: form.fields.map((f) => localizeField(f, lang)) });

/** Languages whose script runs right to left. */
export const RTL_FORM_LANGUAGES: ReadonlySet<string> = new Set(["ar", "ur", "ps", "fa", "he"]);
export const isRtlLanguage = (lang: string | undefined): boolean => lang !== undefined && RTL_FORM_LANGUAGES.has(lang);

/** Which wording is still missing for a language, so the designer can see what is untranslated. */
export function missingTranslations(form: FormDefinition, lang: string): string[] {
  const out: string[] = [];
  const visit = (f: FormField, path: string): void => {
    if (f.type !== "NOTE" || f.label) if (!f.labels?.[lang]?.trim()) out.push(path);
    for (const c of f.fields ?? []) visit(c, `${path}.${c.key}`);
    for (const r of f.rows ?? []) if (!r.labels?.[lang]?.trim()) out.push(`${path}.${r.key}`);
    for (const c of f.columns ?? []) if (!c.labels?.[lang]?.trim()) out.push(`${path}.${c.key}`);
  };
  for (const f of form.fields) visit(f, f.key);
  return out;
}
