import { isNotApplicable } from "./answer-values.js";
import type { FormDefinition, FormField } from "./form-model.js";
import { visibleFields } from "./form-rules.js";
import type { ScoreResult } from "./scoring.js";

/**
 * A completed assessment as a document model (Phase 62.9): the form's own sections, tables and rows with the answers written out in
 * words. Pure, so the PDF and the workbook are drawn from one model and cannot disagree. A missing answer reads "Not answered" and a
 * not-applicable one "Not applicable"; nothing is shown as 0 unless 0 was answered. Files and signatures are named, never embedded.
 */
export interface DocRow { label: string; answer: string; how?: string; note?: string }
export interface DocTable { title: string; headers: string[]; rows: string[][] }
export interface DocSection { title: string; intro?: string; rows: DocRow[]; tables: DocTable[] }
export interface AssessmentDocument {
  title: string;
  facility?: string;
  visitedOn?: string;
  sections: DocSection[];
  score?: { overall: number | null; band?: string; illustrative: boolean; sections: Array<{ title: string; percent: number | null; skipped?: boolean }> };
  signatures: Array<{ signer: string; signed: boolean }>;
}

const NOT_ANSWERED = "Not answered";

function say(f: Pick<FormField, "type" | "options">, v: unknown): string {
  if (isNotApplicable(v)) return "Not applicable";
  if (v === undefined || v === null || v === "") return NOT_ANSWERED;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.map((x) => f.options?.find((o) => o.value === x)?.label ?? String(x)).join(", ") || NOT_ANSWERED;
  if (typeof v === "object") { const g = v as { lat?: unknown; lon?: unknown }; return typeof g.lat === "number" && typeof g.lon === "number" ? `${g.lat}, ${g.lon}` : NOT_ANSWERED; }
  if (f.type === "FILE") return "File attached";
  if (f.type === "SIGNATURE") return "Signed";
  return f.options?.find((o) => o.value === v)?.label ?? String(v);
}

export function buildAssessmentDocument(
  form: FormDefinition, title: string, answers: Readonly<Record<string, unknown>>, how: Readonly<Record<string, string>> = {}, score?: ScoreResult,
  facts: { facility?: string; visitedOn?: string } = {},
): AssessmentDocument {
  const sections: DocSection[] = [];
  let current: DocSection = { title: "General", rows: [], tables: [] };
  const flush = (): void => { if (current.rows.length || current.tables.length || current.intro) sections.push(current); };
  const signatures: AssessmentDocument["signatures"] = [];
  // Only the questions that were asked for these answers: a unit the facility does not have is not listed as unanswered.
  for (const f of visibleFields(form, answers)) {
    const v = answers[f.key];
    if (f.type === "SECTION") { flush(); current = { title: f.label, ...(f.help ? { intro: f.help } : {}), rows: [], tables: [] }; continue; }
    if (f.type === "NOTE") continue;
    if (f.type === "SIGNATURE") { signatures.push({ signer: f.signer ?? f.label, signed: typeof v === "string" && v !== "" }); continue; }
    if (f.type === "GRID") {
      const grid = (v ?? {}) as Record<string, Record<string, unknown>>;
      current.tables.push({
        title: f.label, headers: ["", ...(f.columns ?? []).map((c) => c.label)],
        rows: (f.rows ?? []).map((r) => [r.label, ...(f.columns ?? []).map((c) => say({ type: c.type, options: c.options }, grid[r.key]?.[c.key]))]),
      });
      continue;
    }
    if (f.type === "REPEAT") {
      const items = Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [];
      const kids = (f.fields ?? []).filter((c) => c.type !== "NOTE" && c.type !== "SECTION");
      current.tables.push({ title: f.label, headers: [f.rowLabel ?? "No.", ...kids.map((c) => c.label)], rows: items.map((item, i) => [String(i + 1), ...kids.map((c) => say(c, item[c.key]))]) });
      continue;
    }
    current.rows.push({ label: f.label, answer: say(f, v), ...(how[f.key] ? { how: how[f.key]!.replace("_", " ").toLowerCase() } : {}) });
  }
  flush();
  return {
    title, ...(facts.facility ? { facility: facts.facility } : {}), ...(facts.visitedOn ? { visitedOn: facts.visitedOn } : {}), sections, signatures,
    ...(score ? { score: { overall: score.overall, ...(score.band ? { band: score.band.label } : {}), illustrative: score.illustrative, sections: score.sections.map((s) => ({ title: s.title, percent: s.percent, ...(s.skipped ? { skipped: true } : {}) })) } } : {}),
  };
}
