import { blank, isNotApplicable } from "../answer-values.js";
import type { FormField, GridColumn } from "../form-model.js";
import { FORM_LIMITS } from "../form-limits.js";
import { bad, ok, type FieldCtx, type FieldOutcome, type FieldTypeDef } from "./contract.js";

const KEY = /^[a-z][a-z0-9_]{0,39}$/;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const rowIsBlank = (row: Record<string, unknown>): boolean => Object.values(row).every((v) => blank(v) && !isNotApplicable(v));

/** Several rows of the same questions (blocks, wards, rooms, staff). The answer is a list with one object per row. */
const REPEAT: FieldTypeDef = {
  asks: true,
  requiredByShape: (f) => (f.minRows ?? 0) > 0,
  validate(f, raw, ctx) {
    const path = ctx.prefix + f.key;
    if (!Array.isArray(raw)) return bad(path, `${f.label}: send the rows as a list.`, "SHAPE", { label: f.label });
    const kept: Record<string, unknown>[] = [];
    const problems: FieldOutcome["problems"] = [];
    raw.forEach((row, i) => {
      if (!isObject(row)) { problems.push({ field: `${path}[${i}]`, message: `${f.label}: row ${i + 1} is not a set of answers.`, code: "SHAPE", params: { label: f.label } }); return; }
      if (rowIsBlank(row)) return;
      const checked = ctx.validateList(f.fields ?? [], row, `${path}[${i}].`);
      problems.push(...checked.problems);
      kept.push(checked.values);
    });
    const min = f.minRows ?? 0;
    const max = Math.min(f.maxRows ?? FORM_LIMITS.repeatRows, FORM_LIMITS.repeatRows);
    if (kept.length < min) problems.push({ field: path, message: `${f.label} needs at least ${min} ${min === 1 ? "row" : "rows"}.`, code: "ROWS_MIN", params: { label: f.label, min } });
    if (kept.length > max) problems.push({ field: path, message: `${f.label} can have at most ${max} rows.`, code: "ROWS_MAX", params: { label: f.label, max } });
    return { value: kept, problems };
  },
  checkDefinition(f, ctx) {
    const out: string[] = [];
    const children = f.fields ?? [];
    if (ctx.insideRepeat) out.push("A repeat cannot sit inside another repeat.");
    if (children.length === 0) out.push("A repeat needs at least one question.");
    if (children.length > FORM_LIMITS.repeatFields) out.push(`A repeat can have at most ${FORM_LIMITS.repeatFields} questions.`);
    for (const c of children) if (["REPEAT", "SECTION", "GRID", "NOTE"].includes(c.type)) out.push(`"${c.key}": a repeat's questions cannot be a ${c.type.toLowerCase()}.`);
    if (f.minRows !== undefined && f.maxRows !== undefined && f.minRows > f.maxRows) out.push("The fewest rows is above the most rows.");
    if (f.maxRows !== undefined && f.maxRows > FORM_LIMITS.repeatRows) out.push(`A repeat can have at most ${FORM_LIMITS.repeatRows} rows.`);
    out.push(...ctx.checkChildren(children, ctx.earlier));
    return out;
  },
};

const cellField = (col: GridColumn, label: string): FormField => ({
  key: col.key, label, type: col.type, ...(col.min !== undefined ? { min: col.min } : {}), ...(col.max !== undefined ? { max: col.max } : {}), ...(col.options ? { options: col.options } : {}),
});

/** A table of rows against typed columns (a tick grid, a count by condition, a year series). The answer is `{ rowKey: { columnKey: value } }`. */
const GRID: FieldTypeDef = {
  asks: true,
  validate(f, raw, ctx) {
    const path = ctx.prefix + f.key;
    if (!isObject(raw)) return bad(path, `${f.label}: send the table as rows of answers.`, "SHAPE", { label: f.label });
    const rows = f.rows ?? [];
    const columns = f.columns ?? [];
    const problems: FieldOutcome["problems"] = [];
    for (const key of Object.keys(raw)) if (!rows.some((r) => r.key === key)) problems.push({ field: `${path}.${key}`, message: `${f.label}: "${key}" is not a row of this table.`, code: "SHAPE", params: { label: f.label } });
    const value: Record<string, Record<string, unknown>> = {};
    for (const row of rows) {
      const given = raw[row.key];
      if (given === undefined) { for (const col of columns) if (col.required) problems.push(required(path, row.key, row.label, col, f)); continue; }
      if (!isObject(given)) { problems.push({ field: `${path}.${row.key}`, message: `${f.label}: ${row.label} is not a set of answers.`, code: "SHAPE", params: { label: f.label } }); continue; }
      for (const key of Object.keys(given)) if (!columns.some((c) => c.key === key)) problems.push({ field: `${path}.${row.key}.${key}`, message: `${f.label}: "${key}" is not a column of this table.`, code: "SHAPE", params: { label: f.label } });
      const cells: Record<string, unknown> = {};
      for (const col of columns) {
        const cell = given[col.key];
        const where = `${path}.${row.key}.${col.key}`;
        if (col.allowNotApplicable && isNotApplicable(cell)) { cells[col.key] = { na: true, ...(typeof cell.reason === "string" && cell.reason.trim() ? { reason: cell.reason.trim() } : {}) }; continue; }
        if (blank(cell)) { if (col.required) problems.push(required(path, row.key, row.label, col, f)); continue; }
        const checked = ctx.validateOne(cellField(col, `${row.label} — ${col.label}`), cell, "");
        for (const p of checked.problems) problems.push({ ...p, field: where });
        if (checked.value !== undefined) cells[col.key] = checked.value;
      }
      if (Object.keys(cells).length > 0) value[row.key] = cells;
    }
    return { value, problems };
  },
  checkDefinition(f, ctx) {
    const out: string[] = [];
    const rows = f.rows ?? [];
    const columns = f.columns ?? [];
    if (ctx.insideRepeat) out.push("A table cannot sit inside a repeat.");
    if (rows.length === 0) out.push("A table needs at least one row.");
    if (columns.length === 0) out.push("A table needs at least one column.");
    if (rows.length > FORM_LIMITS.gridRows) out.push(`A table can have at most ${FORM_LIMITS.gridRows} rows.`);
    if (columns.length > FORM_LIMITS.gridColumns) out.push(`A table can have at most ${FORM_LIMITS.gridColumns} columns.`);
    for (const [list, name] of [[rows.map((r) => r.key), "row"], [columns.map((c) => c.key), "column"]] as const) {
      if (list.some((k) => !KEY.test(k))) out.push(`A ${name} key must be lower-case letters, digits and underscores, starting with a letter.`);
      if (new Set(list).size !== list.length) out.push(`Two ${name}s of the table have the same key.`);
    }
    for (const c of columns) {
      if (!["NUMBER", "TEXT", "SELECT", "YES_NO", "FILE"].includes(c.type)) out.push(`Column "${c.key}": ${String(c.type)} is not a column type.`);
      if (c.type === "SELECT" && (c.options ?? []).length < 2) out.push(`Column "${c.key}" needs at least two options.`);
      if (c.min !== undefined && c.max !== undefined && c.min > c.max) out.push(`Column "${c.key}": the smallest value is above the largest.`);
    }
    return out;
  },
};

function required(path: string, rowKey: string, rowLabel: string, col: GridColumn, f: FormField): FieldOutcome["problems"][number] {
  const label = `${f.label}: ${rowLabel} — ${col.label}`;
  return { field: `${path}.${rowKey}.${col.key}`, message: `${label} is required.`, code: "REQUIRED", params: { label } };
}

export const NESTED_FIELD_TYPES = { REPEAT, GRID } as const;
export type { FieldCtx };
