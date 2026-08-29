/**
 * Deterministic artifact validators — TS mirror of
 * `apps/workers/app/ai_reporter/artifact_validators.py`.
 *
 * Pure, side-effect-free validators that run on every GeneratedSection before
 * it is persisted. Each returns `{ ok, issues }` where `issues` is a list of
 * short machine-readable strings; downstream consumers (eval, application) can
 * surface them as audit records.
 *
 * Each individual validator is exported for testability; `runAll()` aggregates
 * the set. The set of "hard" validators that fail the case is the same on both
 * sides of the worker boundary.
 */

import type { GeneratedSection } from "@donordesk/application";
import { BANNED_PHRASES } from "../llm/ai-reporter/contract.js";

export interface ValidationResult {
  ok: boolean;
  issues: string[];
}

function ok(): ValidationResult {
  return { ok: true, issues: [] };
}

function fail(issue: string): ValidationResult {
  return { ok: false, issues: [issue] };
}

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function normaliseTokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []) as string[];
}

function artifactPayload(art: { kind: string; payload: unknown }): Record<string, unknown> {
  if (art.payload && typeof art.payload === "object") return art.payload as Record<string, unknown>;
  return {};
}

function artifactsAsDicts(section: GeneratedSection): Array<{
  kind: string;
  ordinal: number;
  caption?: string;
  payload: Record<string, unknown>;
  sourceReferences: ReadonlyArray<unknown>;
}> {
  return (section.artifacts ?? []).map((art) => ({
    kind: art.kind,
    ordinal: art.ordinal,
    caption: art.caption,
    payload: artifactPayload(art),
    sourceReferences: art.sourceReferences,
  }));
}

function qaAsDicts(section: GeneratedSection): Array<{
  question: string;
  answer: string;
  sourceReferences: ReadonlyArray<unknown>;
}> {
  return (section.qa ?? []).map((item) => ({
    question: item.question,
    answer: item.answer,
    sourceReferences: item.sourceReferences,
  }));
}

function collectArtifactText(section: GeneratedSection): string {
  const bits: string[] = [];
  for (const art of artifactsAsDicts(section)) {
    const payload = art.payload;
    if (art.kind === "TABLE") {
      const rows = (payload.rows as Array<{ cells?: ReadonlyArray<unknown> }> | undefined) ?? [];
      for (const row of rows) {
        for (const c of row.cells ?? []) {
          if (c !== null && c !== undefined) bits.push(String(c));
        }
      }
    } else if (art.kind === "CHART") {
      const cats = (payload.categories as ReadonlyArray<unknown> | undefined) ?? [];
      for (const c of cats) bits.push(String(c));
      const series = (payload.series as ReadonlyArray<{ data?: ReadonlyArray<unknown> }> | undefined) ?? [];
      for (const s of series) {
        for (const d of s.data ?? []) {
          if (d !== null && d !== undefined) bits.push(String(d));
        }
      }
    } else if (art.kind === "LIST") {
      const items = (payload.items as ReadonlyArray<{ text?: string }> | undefined) ?? [];
      for (const it of items) bits.push(it.text ?? "");
    } else if (art.kind === "KEY_VALUE") {
      const entries = (payload.entries as ReadonlyArray<{ value?: string }> | undefined) ?? [];
      for (const e of entries) bits.push(e.value ?? "");
    } else if (art.kind === "QA") {
      bits.push(String(payload.answer ?? ""));
    } else if (art.kind === "DELTA") {
      bits.push(String(payload.fromValue ?? ""));
      bits.push(String(payload.toValue ?? ""));
    }
  }
  return bits.join("\n");
}

export function assertNumericExactness(
  section: GeneratedSection,
  verifiedNumbers: ReadonlySet<string>,
): ValidationResult {
  if (verifiedNumbers.size === 0) return ok();
  const content = section.content ?? "";
  const artifactText = collectArtifactText(section);
  const haystack = (content + "\n" + artifactText).toLowerCase();
  const missing: string[] = [];
  for (const v of verifiedNumbers) {
    if (!haystack.includes(v.toLowerCase())) missing.push(v);
  }
  if (missing.length > 0) {
    return fail(`NUMERIC_PARAPHRASE missing: ${missing.sort().join(", ")}`);
  }
  return ok();
}

export function assertTableCitation(section: GeneratedSection): ValidationResult {
  for (const art of artifactsAsDicts(section)) {
    if (art.kind !== "TABLE") continue;
    const rows = (art.payload.rows as Array<{ cells?: ReadonlyArray<unknown>; sourceReferences?: ReadonlyArray<unknown> }> | undefined) ?? [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const refs = row.sourceReferences ?? [];
      const cells = row.cells ?? [];
      const nonEmpty = cells.filter((c) => c !== null && c !== undefined && c !== "");
      if (nonEmpty.length > 0 && refs.length < 1) {
        return fail(`TABLE row ${i} missing sourceReferences`);
      }
    }
  }
  return ok();
}

export function assertChartDataGrounding(
  section: GeneratedSection,
  verifiedNumbers: ReadonlySet<string>,
): ValidationResult {
  if (verifiedNumbers.size === 0) return ok();
  const verifiedLower = new Set<string>();
  for (const v of verifiedNumbers) verifiedLower.add(v.toLowerCase());
  for (const art of artifactsAsDicts(section)) {
    if (art.kind !== "CHART") continue;
    const series = (art.payload.series as ReadonlyArray<{ name?: string; data?: ReadonlyArray<unknown> }> | undefined) ?? [];
    for (const s of series) {
      const data = s.data ?? [];
      for (let j = 0; j < data.length; j++) {
        const point = data[j];
        if (point === null || point === undefined || point === "") continue;
        if (!verifiedLower.has(String(point).toLowerCase())) {
          return fail(`CHART series '${s.name ?? "?"}' data[${j}]=${String(point)} not in verified numbers`);
        }
      }
    }
  }
  return ok();
}

export interface MandatoryQuestionsContext {
  mandatoryQuestions: ReadonlyArray<string>;
}

export function assertMandatoryQuestionsAnswered(
  section: GeneratedSection,
  ctx: MandatoryQuestionsContext,
): ValidationResult {
  const questions = ctx.mandatoryQuestions ?? [];
  if (questions.length === 0) return ok();
  const qa = qaAsDicts(section);
  const answered = new Set(qa.map((item) => item.question.trim().toLowerCase()));
  const missing: string[] = [];
  for (const q of questions) {
    if (!answered.has(q.trim().toLowerCase())) missing.push(q);
  }
  if (missing.length > 0) return fail(`MISSING_QA: ${missing.join(", ")}`);
  for (let i = 0; i < qa.length; i++) {
    const item = qa[i];
    if (!item) continue;
    if ((item.sourceReferences ?? []).length < 1) {
      return fail(`QA[${i}] missing sourceReferences`);
    }
  }
  return ok();
}

export function assertDeltaFromPrior(section: GeneratedSection, priorNarrativePresent: boolean): ValidationResult {
  if (!priorNarrativePresent) return ok();
  if (section.deltaFromPrior === undefined || section.deltaFromPrior === null) {
    return fail("MISSING_DELTA: deltaFromPrior is required when prior narrative exists");
  }
  return ok();
}

export interface WordCountContext {
  minWords?: number;
  maxWords?: number;
}

export function assertWordCount(section: GeneratedSection, ctx: WordCountContext): ValidationResult {
  const content = section.content ?? "";
  const count = words(content).length;
  const issues: string[] = [];
  if (ctx.minWords !== undefined && count < ctx.minWords) {
    issues.push(`WORD_LIMIT: ${count} words < minWords=${ctx.minWords}`);
  }
  if (ctx.maxWords !== undefined && count > ctx.maxWords) {
    issues.push(`WORD_LIMIT: ${count} words > maxWords=${ctx.maxWords}`);
  }
  if (issues.length > 0) return { ok: false, issues };
  return ok();
}

export function assertRepetition(
  section: GeneratedSection,
  priorSummary: ReadonlyArray<string> | undefined,
): ValidationResult {
  if (!priorSummary || priorSummary.length === 0) return ok();
  const newSents = (section.content ?? "")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  const priorSents: string[] = [];
  for (const blob of priorSummary) {
    priorSents.push(...String(blob).trim().split(/(?<=[.!?])\s+/).filter(Boolean));
  }
  if (newSents.length === 0 || priorSents.length === 0) return ok();
  for (const ns of newSents) {
    const nsTokens = new Set(normaliseTokens(ns));
    if (nsTokens.size === 0) continue;
    for (const ps of priorSents) {
      const psTokens = new Set(normaliseTokens(ps));
      if (psTokens.size === 0) continue;
      const intersection = new Set([...nsTokens].filter((t) => psTokens.has(t)));
      const union = new Set([...nsTokens, ...psTokens]);
      const overlap = intersection.size / Math.max(1, union.size);
      if (overlap >= 0.7) return fail("DUPLICATE: sentence overlaps prior section");
    }
  }
  return ok();
}

export function assertBannedPhrases(section: GeneratedSection): ValidationResult {
  const haystack = (section.content ?? "").toLowerCase();
  const hits: string[] = [];
  for (const phrase of BANNED_PHRASES) {
    if (haystack.includes(phrase.toLowerCase())) hits.push(phrase);
  }
  if (hits.length > 0) return fail(`BANNED_PHRASE: ${hits.join(", ")}`);
  return ok();
}

export function assertArtifactOrdering(section: GeneratedSection): ValidationResult {
  const ordinals = artifactsAsDicts(section).map((a) => a.ordinal);
  for (let i = 1; i < ordinals.length; i++) {
    const prev = ordinals[i - 1];
    const curr = ordinals[i];
    if (prev === undefined || curr === undefined) continue;
    if (curr <= prev) return fail(`ARTIFACT_ORDER: ordinal not strictly increasing (${prev}->${curr})`);
    if (curr - prev > 1) return fail(`ARTIFACT_ORDER: ordinal gap > 1 (${prev}->${curr})`);
  }
  return ok();
}

export interface RunAllOptions {
  verifiedNumbers?: ReadonlySet<string>;
  priorNarrativePresent?: boolean;
  mandatoryQuestions?: ReadonlyArray<string>;
  priorSectionsSummary?: ReadonlyArray<string>;
  minWords?: number;
  maxWords?: number;
}

export function runAll(section: GeneratedSection, opts: RunAllOptions = {}): ValidationResult {
  const verifiedNumbers = opts.verifiedNumbers ?? new Set<string>();
  const results: ValidationResult[] = [
    assertNumericExactness(section, verifiedNumbers),
    assertTableCitation(section),
    assertChartDataGrounding(section, verifiedNumbers),
    assertMandatoryQuestionsAnswered(section, { mandatoryQuestions: opts.mandatoryQuestions ?? [] }),
    assertDeltaFromPrior(section, opts.priorNarrativePresent === true),
    assertWordCount(section, { minWords: opts.minWords, maxWords: opts.maxWords }),
    assertRepetition(section, opts.priorSectionsSummary ?? []),
    assertBannedPhrases(section),
    assertArtifactOrdering(section),
  ];
  const issues: string[] = [];
  for (const r of results) issues.push(...r.issues);
  return { ok: issues.length === 0, issues };
}
