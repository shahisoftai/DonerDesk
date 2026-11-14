import type { FormDefinition, FormFieldType } from "../collection/form-rules.js";
import type { ColumnDef, DatasetRowValues } from "./model.js";

/**
 * A collection form's accepted records as a dataset (Phase 54 §3.10, J6): read-only, nothing copied, always current. Its id is
 * `form-<formId>` inside the dataset prefix, so every dataset path (visuals, slicers, links) reads it unchanged. Free text, GPS points and
 * files are left out: they can identify a person, and a dataset holds figures (§8.2). The period is the month the record was sent.
 */
export const FORM_DATASET_PREFIX = "form-";
export const formDatasetId = (formId: string): string => `${FORM_DATASET_PREFIX}${formId}`;
export const formIdOf = (datasetId: string): string | undefined => (datasetId.startsWith(FORM_DATASET_PREFIX) ? datasetId.slice(FORM_DATASET_PREFIX.length) : undefined);

const AS_COLUMN: Readonly<Record<FormFieldType, Pick<ColumnDef, "kind" | "semantic"> | null>> = {
  NUMBER: { kind: "COUNT", semantic: "NONE" },
  DATE: { kind: "DATE", semantic: "NONE" },
  SELECT: { kind: "TEXT", semantic: "NONE" },
  YES_NO: { kind: "YES_NO", semantic: "NONE" },
  PLACE: { kind: "TEXT", semantic: "PLACE" },
  TEXT: null,
  GPS: null,
  FILE: null,
};

export const SENT_MONTH_KEY = "sent_month";

export function formColumns(def: FormDefinition): ColumnDef[] {
  const cols: ColumnDef[] = [{ key: SENT_MONTH_KEY, label: "Month sent", sourceHeader: "Month sent", kind: "MONTH", semantic: "PERIOD", hideOnShareLinks: false }];
  for (const f of def.fields) {
    const as = AS_COLUMN[f.type];
    if (!as || f.key === SENT_MONTH_KEY) continue;
    cols.push({ key: /^[a-z]/.test(f.key) ? f.key : `f_${f.key}`, label: f.label, sourceHeader: f.key, ...as, hideOnShareLinks: false });
  }
  return cols;
}

/** Records as rows. A number answer that is not a number is not reported (null), never 0; the place is matched later like any place column. */
export function formRows(records: ReadonlyArray<{ answers: Record<string, unknown>; submittedOn: string }>, columns: readonly ColumnDef[]): DatasetRowValues[] {
  return records.map((r, i) => {
    const values: DatasetRowValues["values"] = { [SENT_MONTH_KEY]: r.submittedOn.slice(0, 7) };
    for (const c of columns) {
      if (c.key === SENT_MONTH_KEY) continue;
      const v = r.answers[c.sourceHeader];
      values[c.key] = c.kind === "COUNT" ? (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null)
        : c.kind === "YES_NO" ? (typeof v === "boolean" ? v : v === "yes" ? true : v === "no" ? false : null)
        : typeof v === "string" && v.trim() ? v.trim() : null;
    }
    return { rowNo: i + 1, values, periodKey: r.submittedOn.slice(0, 7) };
  });
}
