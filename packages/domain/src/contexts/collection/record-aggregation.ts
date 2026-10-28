/**
 * Records as an indicator source (Phase 33.5): rows collected by a form are counted or summed into an indicator's value for each
 * reporting period. Pure. A record joins the period its date falls in (the mapped date field, else the day it was submitted); one
 * that falls in no period, or lacks the figure a sum needs, is listed apart — never dropped, never counted as 0. Records that share a
 * dedup key count once (the latest wins), so a re-sent submission is not counted twice.
 */
export type RecordMethod = "COUNT" | "SUM";

export interface RecordMapping {
  indicatorId: string;
  method: RecordMethod;
  /** The number field to add up (SUM). */
  valueField?: string;
  /** The date field that decides the period; absent = the day the record was submitted. */
  dateField?: string;
  /** Answers that make a record the same one: records agreeing on all of them count once. */
  dedupFields?: ReadonlyArray<string>;
}

export interface CollectedRecord {
  id: string;
  /** A plain day, `YYYY-MM-DD`. */
  submittedOn: string;
  answers: Readonly<Record<string, unknown>>;
}

export interface RecordPeriod {
  id: string;
  /** Plain days, inclusive. */
  start: string;
  end: string;
}

export interface RecordPeriodTotal {
  periodId: string;
  /** Decimal string; "" when nothing was collected for the period (not measured, never 0). */
  value: string;
  recordCount: number;
  recordIds: string[];
}

export interface RecordAggregation {
  periods: RecordPeriodTotal[];
  /** Records no period covers. */
  outsidePeriods: string[];
  /** Records a sum could not use because the figure is missing or not a number. */
  missingFigure: string[];
  /** Records left out as repeats of a later one. */
  duplicates: string[];
}

const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const tidy = (n: number): string => String(Math.round(n * 1e6) / 1e6);

export function aggregateRecords(records: ReadonlyArray<CollectedRecord>, mapping: RecordMapping, periods: ReadonlyArray<RecordPeriod>): RecordAggregation {
  const duplicates: string[] = [];
  let kept: CollectedRecord[] = [...records].sort((a, b) => a.submittedOn.localeCompare(b.submittedOn) || a.id.localeCompare(b.id));
  const dedup = mapping.dedupFields ?? [];
  if (dedup.length > 0) {
    const latest = new Map<string, CollectedRecord>();
    for (const r of kept) {
      const answers = dedup.map((f) => String(r.answers[f] ?? "").trim().toLowerCase());
      // A record with none of the identifying answers cannot be matched with another: it stands alone.
      if (answers.every((a) => a === "")) { latest.set(`id:${r.id}`, r); continue; }
      const key = answers.join("\u0001");
      const earlier = latest.get(key);
      if (earlier) duplicates.push(earlier.id);
      latest.set(key, r);
    }
    kept = [...latest.values()];
  }

  const outsidePeriods: string[] = [];
  const missingFigure: string[] = [];
  const buckets = new Map<string, { sum: number; ids: string[] }>();
  for (const r of kept) {
    const dateAnswer = mapping.dateField ? String(r.answers[mapping.dateField] ?? "").trim() : "";
    const day = dateAnswer || r.submittedOn;
    const period = periods.find((p) => day >= p.start && day <= p.end);
    if (!period) { outsidePeriods.push(r.id); continue; }
    let amount = 1;
    if (mapping.method === "SUM") {
      const n = mapping.valueField ? num(r.answers[mapping.valueField]) : null;
      if (n === null) { missingFigure.push(r.id); continue; }
      amount = n;
    }
    const b = buckets.get(period.id) ?? { sum: 0, ids: [] };
    b.sum += amount;
    b.ids.push(r.id);
    buckets.set(period.id, b);
  }

  return {
    periods: periods.map((p) => {
      const b = buckets.get(p.id);
      return { periodId: p.id, value: b ? tidy(b.sum) : "", recordCount: b?.ids.length ?? 0, recordIds: b?.ids ?? [] };
    }),
    outsidePeriods,
    missingFigure,
    duplicates,
  };
}

/** Problems with a mapping against a form's fields; the same checks run when it is saved. */
export function recordMappingProblems(mapping: RecordMapping, fields: ReadonlyArray<{ key: string; type: string }>): string[] {
  const byKey = new Map(fields.map((f) => [f.key, f.type]));
  const problems: string[] = [];
  if (mapping.method === "SUM") {
    if (!mapping.valueField) problems.push("Choose the number field to add up.");
    else if (byKey.get(mapping.valueField) !== "NUMBER") problems.push("Only a number field can be added up.");
  }
  if (mapping.dateField && byKey.get(mapping.dateField) !== "DATE") problems.push("The date that decides the period must be a date field.");
  for (const f of mapping.dedupFields ?? []) if (!byKey.has(f)) problems.push(`"${f}" is not a field of the form.`);
  return problems;
}
