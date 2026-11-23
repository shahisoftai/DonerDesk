import type { FormField, GridColumn, GridRow } from "../form-model.js";
import type { ScoreItem } from "../scoring.js";

/** Small helpers a kit uses to say a form in a few lines. Pure data builders: no rules live here. */
export const slug = (text: string): string => {
  const base = text.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30);
  return /^[a-z]/.test(base) ? base : `r_${base}`.slice(0, 32);
};

/** Rows from labels, with a key made from each label (two equal labels get a number). */
export function rowsOf(labels: readonly string[]): GridRow[] {
  const used = new Set<string>();
  return labels.map((label) => {
    let key = slug(label) || "row";
    const base = key;
    for (let n = 2; used.has(key); n += 1) key = `${base.slice(0, 28)}_${n}`;
    used.add(key);
    return { key, label };
  });
}

export const section = (key: string, label: string, help?: string, relevantWhen?: FormField["relevantWhen"]): FormField =>
  ({ key, label, type: "SECTION", ...(help ? { help } : {}), ...(relevantWhen ? { relevantWhen } : {}) });
export const note = (key: string, label: string): FormField => ({ key, label, type: "NOTE" });
export const field = (key: string, label: string, type: FormField["type"], extra: Partial<FormField> = {}): FormField => ({ key, label, type, ...extra });
export const yesNo = (key: string, label: string, extra: Partial<FormField> = {}): FormField => field(key, label, "YES_NO", extra);
export const num = (key: string, label: string, extra: Partial<FormField> = {}): FormField => field(key, label, "NUMBER", { min: 0, ...extra });
export const choice = (key: string, label: string, options: readonly string[], extra: Partial<FormField> = {}): FormField =>
  field(key, label, "SELECT", { options: options.map((o) => ({ value: slug(o), label: o })), ...extra });

export const GOOD_FAIR_POOR = ["Good", "Average", "Poor"] as const;
export const col = {
  yesNo: (key: string, label: string, extra: Partial<GridColumn> = {}): GridColumn => ({ key, label, type: "YES_NO", ...extra }),
  num: (key: string, label: string, extra: Partial<GridColumn> = {}): GridColumn => ({ key, label, type: "NUMBER", min: 0, ...extra }),
  text: (key: string, label: string): GridColumn => ({ key, label, type: "TEXT" }),
  choice: (key: string, label: string, options: readonly string[]): GridColumn => ({ key, label, type: "SELECT", options: options.map((o) => ({ value: slug(o), label: o })) }),
};

export const grid = (key: string, label: string, labels: readonly string[], columns: GridColumn[], extra: Partial<FormField> = {}): FormField =>
  ({ key, label, type: "GRID", rows: rowsOf(labels), columns, ...extra });

/** A yes/no item worth 1 or 0, for every row of a grid column. */
export const yesNoItem = (path: string, label: string): ScoreItem => ({ path, label, points: { yes: 1, no: 0 } });
export const ratingItem = (path: string, label: string): ScoreItem => ({ path, label, points: { good: 2, average: 1, fair: 1, poor: 0 } });
