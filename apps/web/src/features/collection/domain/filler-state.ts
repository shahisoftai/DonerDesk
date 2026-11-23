import { FIELD_TYPE_DEFS, blank, isNotApplicable, visibleFields, type FormDefinition, type FormField, type FormProblem } from "@donordesk/domain/contexts/collection/index.js";

/**
 * The filler's pure rules (Phase 62): how a long form splits into sections, how far each section is answered, and how a problem finds the
 * question it belongs to. No React, no clock, no network; the screen only draws what this says.
 */
export interface FillSection {
  key: string;
  title: string;
  intro?: string;
  /** The questions (and notes) of the section that are asked for these answers, in order. */
  fields: FormField[];
}

/** Splits the asked fields at each section heading. Fields before the first heading form a "General" section only when there are any. */
export function sectionsOf(form: FormDefinition, answers: Readonly<Record<string, unknown>>, generalTitle: string): FillSection[] {
  const asked = visibleFields(form, answers);
  const out: FillSection[] = [];
  let current: FillSection = { key: "_general", title: generalTitle, fields: [] };
  for (const f of asked) {
    if (f.type === "SECTION") {
      if (current.fields.length > 0 || out.length > 0 || current.key !== "_general") out.push(current);
      current = { key: f.key, title: f.label, ...(f.help ? { intro: f.help } : {}), fields: [] };
    } else current.fields.push(f);
  }
  if (current.fields.length > 0 || out.length === 0) out.push(current);
  return out.filter((s) => s.fields.length > 0 || s.key !== "_general");
}

export const askable = (f: FormField): boolean => FIELD_TYPE_DEFS[f.type].asks && !FIELD_TYPE_DEFS[f.type].computed;

export interface SectionProgress { asked: number; answered: number; problems: number }

/** Counts the questions of a section that have an answer (a "not applicable" counts as answered) and the problems that sit inside it. */
export function sectionProgress(section: FillSection, answers: Readonly<Record<string, unknown>>, problems: ReadonlyMap<string, unknown>): SectionProgress {
  const keys = section.fields.filter(askable);
  const answered = keys.filter((f) => !blank(answers[f.key]) || isNotApplicable(answers[f.key])).length;
  let count = 0;
  for (const path of problems.keys()) if (keys.some((f) => path === f.key || path.startsWith(`${f.key}.`) || path.startsWith(`${f.key}[`))) count += 1;
  return { asked: keys.length, answered, problems: count };
}

/** The first problem of each question, by the path the rule engine gives it (`blocks[1].name`, `offices.ms.count`). */
export function problemsByPath(problems: ReadonlyArray<FormProblem>, say: (p: FormProblem) => string): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of problems) if (!out.has(p.field)) out.set(p.field, say(p));
  return out;
}

/** The problems that name the form as a whole or a rule across answers (a constraint), which have no single question to sit beside. */
export const formLevelProblems = (problems: ReadonlyArray<FormProblem>): FormProblem[] => problems.filter((p) => p.code === "CONSTRAINT" || p.field === "");

/** A set of answers with one path changed, without touching the original (a repeat row or a grid cell). */
export function withAnswer(answers: Readonly<Record<string, unknown>>, key: string, value: unknown): Record<string, unknown> {
  const next = { ...answers };
  if (value === undefined) delete next[key]; else next[key] = value;
  return next;
}
export const withRows = (rows: ReadonlyArray<Record<string, unknown>>, index: number, row: Record<string, unknown>): Array<Record<string, unknown>> => rows.map((r, i) => (i === index ? row : r));
