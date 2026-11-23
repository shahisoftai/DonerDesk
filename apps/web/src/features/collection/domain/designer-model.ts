import type { Condition, FormField, FormFieldType, GridColumn, GridColumnType } from "@donordesk/domain/contexts/collection/index.js";

/**
 * The designer's working copy of a question (Phase 62). Every edit is made on a draft and turned back into a field with `fieldOf`, which
 * starts from the ORIGINAL field: a property the designer does not show (wording in another language, a verify rule, a hand-written
 * condition) is kept, never dropped by a save. Pure; no React.
 */
export type Op = "EQ" | "NEQ" | "GT" | "LT" | "FILLED" | "EMPTY" | "CONTAINS";
export interface Rule { field: string; op: Op; value: string }

export interface ColumnDraft { key: string; label: string; type: GridColumnType; optionsText: string; required: boolean; allowNotApplicable: boolean }
export interface ChildDraft { key: string; label: string; type: FormFieldType; required: boolean; optionsText: string }

export interface Draft {
  original: FormField | undefined;
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  optionsText: string;
  min: string;
  max: string;
  showWhen: Rule | null;
  /** A rule the designer cannot show (a group of conditions) is kept as it was. */
  customShow?: unknown;
  requiredWhen: Rule | null;
  customRequired?: unknown;
  help: string;
  allowNotApplicable: boolean;
  carryForward: boolean;
  rowsText: string;
  columns: ColumnDraft[];
  rowLabel: string;
  minRows: string;
  maxRows: string;
  children: ChildDraft[];
  formula: string;
  decimals: string;
  signer: string;
}

export const FIELD_TYPE_ORDER: readonly FormFieldType[] = ["SECTION", "NOTE", "NUMBER", "TEXT", "DATE", "SELECT", "MULTI_SELECT", "YES_NO", "PLACE", "GPS", "FILE", "SIGNATURE", "GRID", "REPEAT", "CALCULATED"];
export const TYPE_LABEL: Readonly<Record<FormFieldType, string>> = {
  NUMBER: "Number", TEXT: "Text", DATE: "Date", SELECT: "Choice (one)", MULTI_SELECT: "Choices (tick all that apply)", YES_NO: "Yes / No", PLACE: "Place", GPS: "GPS point", FILE: "Photo or document",
  SIGNATURE: "Signature", SECTION: "Section heading", NOTE: "Note (text only)", GRID: "Table of rows and columns", REPEAT: "Repeating group (rows of questions)", CALCULATED: "Calculated figure",
};
/** The types a repeat's questions may be (no nesting, no tables). */
export const CHILD_TYPES: readonly FormFieldType[] = ["NUMBER", "TEXT", "DATE", "SELECT", "MULTI_SELECT", "YES_NO", "GPS", "FILE"];
export const COLUMN_TYPES: readonly GridColumnType[] = ["NUMBER", "YES_NO", "SELECT", "TEXT", "FILE"];
export const COLUMN_LABEL: Readonly<Record<GridColumnType, string>> = { NUMBER: "Number", YES_NO: "Yes / No", SELECT: "Choice", TEXT: "Text", FILE: "Photo or document" };

export const slug = (text: string): string => text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30);

export const asRule = (c: unknown): { rule: Rule | null; custom?: unknown } => {
  if (!c) return { rule: null };
  const leaf = c as { field?: unknown; op?: unknown; value?: unknown };
  if (typeof leaf.field === "string" && typeof leaf.op === "string" && ["EQ", "NEQ", "GT", "LT", "FILLED", "EMPTY", "CONTAINS"].includes(leaf.op) && !Array.isArray(leaf.value)) {
    return { rule: { field: leaf.field, op: leaf.op as Op, value: leaf.value === undefined ? "" : String(leaf.value) } };
  }
  return { rule: null, custom: c };
};

export const ruleToCondition = (r: Rule | null, custom: unknown): Condition | undefined => {
  if (r && r.field) return r.op === "FILLED" || r.op === "EMPTY" ? { field: r.field, op: r.op } : { field: r.field, op: r.op, value: r.op === "GT" || r.op === "LT" ? Number(r.value) : r.value };
  return (custom as Condition | undefined) ?? undefined;
};

const optionsText = (options: ReadonlyArray<{ label: string }> | undefined): string => (options ?? []).map((o) => o.label).join("\n");
const text = (n: number | undefined): string => (n === undefined ? "" : String(n));

export function toDraft(f: FormField): Draft {
  const show = asRule(f.relevantWhen);
  const req = asRule(f.requiredWhen);
  return {
    original: f, key: f.key, label: f.label, type: f.type, required: f.required === true, optionsText: optionsText(f.options), min: text(f.min), max: text(f.max),
    showWhen: show.rule, customShow: show.custom, requiredWhen: req.rule, customRequired: req.custom,
    help: f.help ?? "", allowNotApplicable: f.allowNotApplicable === true, carryForward: f.carryForward === true,
    rowsText: (f.rows ?? []).map((r) => r.label).join("\n"),
    columns: (f.columns ?? []).map((c) => ({ key: c.key, label: c.label, type: c.type, optionsText: optionsText(c.options), required: c.required === true, allowNotApplicable: c.allowNotApplicable === true })),
    rowLabel: f.rowLabel ?? "", minRows: text(f.minRows), maxRows: text(f.maxRows),
    children: (f.fields ?? []).map((c) => ({ key: c.key, label: c.label, type: c.type, required: c.required === true, optionsText: optionsText(c.options) })),
    formula: f.formula ?? "", decimals: text(f.decimals), signer: f.signer ?? "",
  };
}

export function blankDraft(key: string, type: FormFieldType = "NUMBER"): Draft {
  return toDraft({ key, label: "", type, required: true });
}

const optionsOf = (t: string): Array<{ value: string; label: string }> => t.split("\n").map((l) => l.trim()).filter(Boolean).map((label, i) => ({ value: slug(label) || `option_${i + 1}`, label }));
const number = (t: string): number | undefined => (t.trim() === "" || !Number.isFinite(Number(t)) ? undefined : Number(t));

/** A row key for a label: the key the row already had when the label is unchanged, else a new one that no other row uses. */
function rowKeys(labels: string[], before: ReadonlyArray<{ key: string; label: string }>): Array<{ key: string; label: string }> {
  const used = new Set<string>();
  return labels.map((label) => {
    let key = before.find((b) => b.label === label && !used.has(b.key))?.key ?? (slug(label) || "row");
    if (!/^[a-z]/.test(key)) key = `r_${key}`;
    const base = key;
    for (let n = 2; used.has(key); n += 1) key = `${base.slice(0, 36)}_${n}`;
    used.add(key);
    return { key, label };
  });
}

const childField = (c: ChildDraft, before: FormField | undefined): FormField => ({
  ...(before ?? {}), key: c.key, label: c.label.trim(), type: c.type, ...(c.required ? { required: true } : { required: undefined }),
  ...(c.type === "SELECT" || c.type === "MULTI_SELECT" ? { options: optionsOf(c.optionsText) } : {}),
}) as FormField;

/** The field a draft stands for. Starts from the original so nothing the designer does not show is lost. */
export function fieldOf(d: Draft): FormField {
  const base: FormField = { ...(d.original ?? { key: d.key, label: d.label, type: d.type }), key: d.key, label: d.label.trim(), type: d.type };
  const out: Record<string, unknown> = { ...base };
  const set = (k: string, v: unknown) => { if (v === undefined || v === "" || v === false) delete out[k]; else out[k] = v; };
  set("required", d.required ? true : undefined);
  set("help", d.help.trim());
  set("allowNotApplicable", d.allowNotApplicable);
  set("carryForward", d.carryForward);
  const choice = d.type === "SELECT" || d.type === "MULTI_SELECT";
  set("options", choice ? optionsOf(d.optionsText) : undefined);
  set("min", d.type === "NUMBER" ? number(d.min) : undefined);
  set("max", d.type === "NUMBER" ? number(d.max) : undefined);
  set("relevantWhen", ruleToCondition(d.showWhen, d.customShow));
  set("requiredWhen", ruleToCondition(d.requiredWhen, d.customRequired));
  if (d.type === "GRID") {
    const before = d.original?.rows ?? [];
    set("rows", rowKeys(d.rowsText.split("\n").map((l) => l.trim()).filter(Boolean), before));
    set("columns", d.columns.map((c): GridColumn => ({
      ...(d.original?.columns?.find((o) => o.key === c.key) ?? {}), key: c.key, label: c.label.trim(), type: c.type,
      ...(c.required ? { required: true } : {}), ...(c.allowNotApplicable ? { allowNotApplicable: true } : {}), ...(c.type === "SELECT" ? { options: optionsOf(c.optionsText) } : {}),
    })));
  } else { delete out.rows; delete out.columns; }
  if (d.type === "REPEAT") {
    set("rowLabel", d.rowLabel.trim());
    set("minRows", number(d.minRows));
    set("maxRows", number(d.maxRows));
    set("fields", d.children.map((c) => childField(c, d.original?.fields?.find((o) => o.key === c.key))));
  } else { delete out.fields; delete out.minRows; delete out.maxRows; delete out.rowLabel; }
  if (d.type === "CALCULATED") { set("formula", d.formula.trim()); set("decimals", number(d.decimals)); set("required", undefined); } else { delete out.formula; delete out.decimals; }
  if (d.type === "SIGNATURE") set("signer", d.signer.trim()); else delete out.signer;
  if (d.type === "SECTION" || d.type === "NOTE") { delete out.required; delete out.requiredWhen; }
  return out as unknown as FormField;
}

/** A key no question uses yet, for a new question or child. */
export function freshKey(taken: Iterable<string>, prefix = "q"): string {
  const used = new Set(taken);
  let n = used.size + 1;
  while (used.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

export function newColumn(taken: Iterable<string>): ColumnDraft {
  return { key: freshKey(taken, "c"), label: "", type: "YES_NO", optionsText: "", required: false, allowNotApplicable: false };
}
export function newChild(taken: Iterable<string>): ChildDraft {
  return { key: freshKey(taken, "f"), label: "", type: "TEXT", required: false, optionsText: "" };
}
