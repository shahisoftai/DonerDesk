/**
 * "Bring in data": one place to start any import. The person says what they have (or pastes the first lines of a file) and is
 * pointed at the screen that reads it. The guide only points: it never reads the rows, never picks silently and never moves the
 * data itself, so each import keeps its own checks ("any bad row blocks the whole import"). Pure.
 */

export type ImportKind =
  | "INDICATOR_VALUES"
  | "INDICATORS"
  | "LOGFRAME"
  | "COMPLETED_ACTIVITIES"
  | "WORK_PLAN"
  | "EVIDENCE"
  | "COLLECTION_RECORDS"
  | "FINANCE"
  | "PLACES";

export interface ImportOption {
  kind: ImportKind;
  title: string;
  /** One sentence: what this brings in. */
  summary: string;
  href: (projectId: string) => string;
  /** Header words that suggest this kind of file (matched on whole words, lower-case, accents ignored). */
  signals: readonly string[];
}

const p = (projectId: string, rest: string) => `/projects/${projectId}${rest}`;

export const IMPORT_OPTIONS: readonly ImportOption[] = [
  { kind: "INDICATOR_VALUES", title: "Indicator values", summary: "The figures for each indicator and period, from a sheet or a copy of the Data Center table.", href: (id) => p(id, "/data"), signals: ["indicator", "period", "value", "cumulative", "achievement", "result"] },
  { kind: "INDICATORS", title: "Indicator definitions", summary: "The indicators themselves: code, name, baseline, target and unit.", href: (id) => p(id, "/logframe/indicators/import"), signals: ["indicator", "baseline", "target", "unit", "frequency", "means"] },
  { kind: "LOGFRAME", title: "Logframe structure", summary: "Goals, outcomes, outputs and activities as a tree.", href: (id) => p(id, "/logframe/import"), signals: ["goal", "outcome", "output", "level", "parent", "assumption"] },
  { kind: "COMPLETED_ACTIVITIES", title: "Completed activities", summary: "Work that has been done: date, place, participants and what happened.", href: (id) => p(id, "/activities/import"), signals: ["activity", "participants", "date", "location", "females", "males", "attended"] },
  { kind: "WORK_PLAN", title: "Planned activities (work plan)", summary: "Work planned ahead, with start and end dates and who leads it.", href: (id) => p(id, "/activities/plan/import"), signals: ["planned", "start", "end", "lead", "title", "milestone"] },
  { kind: "EVIDENCE", title: "Evidence files", summary: "Files or links that prove what was done.", href: (id) => p(id, "/evidence/import"), signals: ["evidence", "file", "link", "url", "document", "filename"] },
  { kind: "COLLECTION_RECORDS", title: "Records for a collection form", summary: "Rows filled in against a form's own questions.", href: (id) => p(id, "/forms"), signals: ["record", "form", "submitted", "respondent"] },
  { kind: "FINANCE", title: "Finance entries", summary: "Expenses and money received for the finance register.", href: (id) => p(id, "/finance"), signals: ["amount", "currency", "category", "vendor", "expense", "disbursement", "budget"] },
  { kind: "PLACES", title: "Places", summary: "The project's list of places, with their parents and pins.", href: () => "/settings/places", signals: ["place", "admin", "parent", "latitude", "longitude", "pcode"] },
];

export interface ImportSuggestion {
  kind: ImportKind;
  title: string;
  href: string;
  /** LIKELY = at least two header words match; POSSIBLE = one. */
  confidence: "LIKELY" | "POSSIBLE";
  /** The header words that matched, shown so the suggestion can be checked. */
  because: string[];
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** The header words of a pasted table or CSV: the first non-empty line, split on tabs, commas, semicolons and spaces. */
export function headerWords(text: string): string[] {
  const first = text.split(/\r?\n/).find((line) => line.trim() !== "");
  if (!first) return [];
  return [...new Set(fold(first).split(/[\t,;|\s]+/).map((w) => w.replace(/[^a-z0-9]/g, "")).filter(Boolean))];
}

/** Which screens could read this file, best first. A file whose first line says nothing recognisable gets no suggestion, never a guess. */
export function suggestImports(text: string, projectId: string): ImportSuggestion[] {
  const words = new Set(headerWords(text));
  if (words.size === 0) return [];
  const out: ImportSuggestion[] = [];
  for (const option of IMPORT_OPTIONS) {
    const because = option.signals.filter((s) => words.has(s) || words.has(`${s}s`));
    if (because.length === 0) continue;
    out.push({ kind: option.kind, title: option.title, href: option.href(projectId), confidence: because.length >= 2 ? "LIKELY" : "POSSIBLE", because: [...because] });
  }
  return out.sort((a, b) => (a.confidence === b.confidence ? b.because.length - a.because.length : a.confidence === "LIKELY" ? -1 : 1));
}
