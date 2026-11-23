import type { FormDefinition, FormField, FormFieldType, GridColumnType } from "../collection/form-rules.js";
import type { ColumnDef, DatasetRowValues, CellValue } from "./model.js";

/**
 * A collection form's accepted records as datasets (Phase 54 J6, widened in Phase 62): read-only, nothing copied, always current. The form
 * is one dataset (`form-<id>`) with a row per record; each repeat is a second dataset (`form-<id>--<repeatKey>`) with a row per repeated
 * item, so a ward or a staff list can be counted and mapped. Free text, GPS points, files and signatures are left out: they can
 * identify a person, and a dataset holds figures (§8.2). A grid becomes one column per row and column; a multi-select one yes/no
 * column per option. Which kind of column a field becomes is one table (`FLATTEN`); nothing branches on a type's name.
 */
export const FORM_DATASET_PREFIX = "form-";
const REPEAT_SEPARATOR = "--";
export const formDatasetId = (formId: string, repeatKey?: string): string => `${FORM_DATASET_PREFIX}${formId}${repeatKey ? `${REPEAT_SEPARATOR}${repeatKey}` : ""}`;

export function formDatasetParts(datasetId: string): { formId: string; repeatKey?: string } | undefined {
  if (!datasetId.startsWith(FORM_DATASET_PREFIX)) return undefined;
  const rest = datasetId.slice(FORM_DATASET_PREFIX.length);
  const [formId, repeatKey] = rest.split(REPEAT_SEPARATOR);
  return formId ? { formId, ...(repeatKey ? { repeatKey } : {}) } : undefined;
}
export const formIdOf = (datasetId: string): string | undefined => formDatasetParts(datasetId)?.formId;

export const SENT_MONTH_KEY = "sent_month";
export const SCORE_KEY = "score_percent";
export const BAND_KEY = "score_band";
export const RECORD_KEY = "record_no";
export const ROW_KEY = "row_no";

type Shape = Pick<ColumnDef, "kind" | "semantic">;
interface Piece { key: string; label: string; header: string; shape: Shape }

const PLAIN: Readonly<Record<GridColumnType | "CALCULATED" | "MULTI", Shape | null>> = {
  NUMBER: { kind: "COUNT", semantic: "NONE" }, SELECT: { kind: "TEXT", semantic: "NONE" }, YES_NO: { kind: "YES_NO", semantic: "NONE" },
  TEXT: null, FILE: null, CALCULATED: { kind: "NUMBER", semantic: "NONE" }, MULTI: { kind: "YES_NO", semantic: "NONE" },
};

/** The columns one field contributes; `[]` when it holds nothing a dataset keeps. */
const FLATTEN: Readonly<Record<FormFieldType, (f: FormField) => Piece[]>> = {
  NUMBER: (f) => [{ key: f.key, label: f.label, header: f.key, shape: PLAIN.NUMBER! }],
  CALCULATED: (f) => [{ key: f.key, label: f.label, header: f.key, shape: PLAIN.CALCULATED! }],
  DATE: (f) => [{ key: f.key, label: f.label, header: f.key, shape: { kind: "DATE", semantic: "NONE" } }],
  SELECT: (f) => [{ key: f.key, label: f.label, header: f.key, shape: PLAIN.SELECT! }],
  YES_NO: (f) => [{ key: f.key, label: f.label, header: f.key, shape: PLAIN.YES_NO! }],
  PLACE: (f) => [{ key: f.key, label: f.label, header: f.key, shape: { kind: "TEXT", semantic: "PLACE" } }],
  MULTI_SELECT: (f) => (f.options ?? []).map((o) => ({ key: `${f.key}__${o.value}`, label: `${f.label}: ${o.label}`, header: `${f.key}#${o.value}`, shape: PLAIN.MULTI! })),
  GRID: (f) => (f.rows ?? []).flatMap((r) => (f.columns ?? []).flatMap((c) => {
    const shape = PLAIN[c.type];
    return shape ? [{ key: `${f.key}__${r.key}__${c.key}`, label: `${f.label} — ${r.label} — ${c.label}`, header: `${f.key}.${r.key}.${c.key}`, shape }] : [];
  })),
  TEXT: () => [], GPS: () => [], FILE: () => [], SIGNATURE: () => [], SECTION: () => [], NOTE: () => [], REPEAT: () => [],
};

const columnOf = (p: Piece): ColumnDef => ({ key: /^[a-z]/.test(p.key) ? p.key : `f_${p.key}`, label: p.label, sourceHeader: p.header, ...p.shape, hideOnShareLinks: false });
const lead = (key: string, label: string, shape: Shape): ColumnDef => ({ key, label, sourceHeader: label, ...shape, hideOnShareLinks: false });

/** The repeats of a form, for listing one dataset each. */
export const formRepeats = (def: FormDefinition): FormField[] => def.fields.filter((f) => f.type === "REPEAT");

/** The columns of the form's dataset, or of one of its repeats. */
export function formColumns(def: FormDefinition, repeatKey?: string): ColumnDef[] {
  if (repeatKey) {
    const repeat = formRepeats(def).find((f) => f.key === repeatKey);
    if (!repeat) return [];
    const cols = [lead(SENT_MONTH_KEY, "Month sent", { kind: "MONTH", semantic: "PERIOD" }), lead(RECORD_KEY, "Record", { kind: "TEXT", semantic: "NONE" }), lead(ROW_KEY, "Row", { kind: "NUMBER", semantic: "NONE" })];
    return [...cols, ...(repeat.fields ?? []).flatMap((f) => FLATTEN[f.type](f)).map(columnOf)];
  }
  const cols = [lead(SENT_MONTH_KEY, "Month sent", { kind: "MONTH", semantic: "PERIOD" })];
  if (def.score) cols.push(lead(SCORE_KEY, "Score (%)", { kind: "NUMBER", semantic: "NONE" }), lead(BAND_KEY, "Score band", { kind: "TEXT", semantic: "NONE" }));
  const seen = new Set(cols.map((c) => c.key));
  for (const f of def.fields) for (const piece of FLATTEN[f.type](f)) { const c = columnOf(piece); if (!seen.has(c.key)) { seen.add(c.key); cols.push(c); } }
  return cols;
}

/** One accepted record, as the dataset reads it. */
export interface FormRecordForDataset {
  id?: string;
  answers: Record<string, unknown>;
  submittedOn: string;
  placeId?: string | undefined;
  score?: { overall: number | null; band?: string | null } | undefined;
}

const read = (answers: unknown, header: string): unknown => {
  const hash = header.indexOf("#");
  if (hash > 0) { const list = (answers as Record<string, unknown>)[header.slice(0, hash)]; return Array.isArray(list) ? list.includes(header.slice(hash + 1)) : null; }
  let node: unknown = answers;
  for (const part of header.split(".")) { if (typeof node !== "object" || node === null) return null; node = (node as Record<string, unknown>)[part]; }
  return node;
};

function cell(c: ColumnDef, v: unknown): CellValue {
  if (typeof v === "object" && v !== null && !Array.isArray(v)) return null; // "not applicable" and any object: no figure, never 0
  if (c.kind === "COUNT" || c.kind === "NUMBER") return typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
  if (c.kind === "YES_NO") return typeof v === "boolean" ? v : v === "yes" ? true : v === "no" ? false : null;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Records as rows (or, for a repeat, one row per repeated item). A figure that is not a number is not reported (null), never 0. */
export function formRows(records: ReadonlyArray<FormRecordForDataset>, columns: readonly ColumnDef[], repeatKey?: string): DatasetRowValues[] {
  const out: DatasetRowValues[] = [];
  const fill = (record: FormRecordForDataset, answers: unknown, extra: Record<string, CellValue>): void => {
    const values: DatasetRowValues["values"] = { [SENT_MONTH_KEY]: record.submittedOn.slice(0, 7), ...extra };
    for (const c of columns) {
      if (c.key in values) continue;
      if (c.key === SCORE_KEY) values[c.key] = record.score?.overall ?? null;
      else if (c.key === BAND_KEY) values[c.key] = record.score?.band ?? null;
      else values[c.key] = cell(c, read(answers, c.sourceHeader));
    }
    out.push({ rowNo: out.length + 1, values, ...(record.placeId ? { placeId: record.placeId } : {}), periodKey: record.submittedOn.slice(0, 7) });
  };
  for (const r of records) {
    if (!repeatKey) { fill(r, r.answers, {}); continue; }
    const items = r.answers[repeatKey];
    if (Array.isArray(items)) items.forEach((item, i) => fill(r, item, { [RECORD_KEY]: r.id ?? "", [ROW_KEY]: i + 1 }));
  }
  return out;
}
