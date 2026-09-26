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
import { assessDonorVoice } from "./donor-voice.js";
import { normaliseNumber, ungroundedNumbers } from "./number-grounding.js";

export interface ValidationResult {
  ok: boolean;
  /** Hard issues (trigger the worker's feedback retry). */
  issues: string[];
  /** Craft signals (donor voice, word minimum) — never fail a section. */
  warnings?: string[];
}

/** Issues meaning the prose may state something the inputs do not support. */
export const INTEGRITY_ISSUE_PREFIXES: readonly string[] = ["UNGROUNDED_NUMBER", "CHART_UNGROUNDED", "NUMERIC_PARAPHRASE", "TABLE row"];

export function integrityIssues(result: ValidationResult): string[] {
  return result.issues.filter((i) => INTEGRITY_ISSUE_PREFIXES.some((p) => i.startsWith(p)));
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

/** Section content without markdown table rows (tables are structure, not prose). */
function prose(text: string): string {
  return (text ?? "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("|"))
    .join("\n");
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

/** Every number in the prose and Q&A answers must exist in the inputs. */
export function assertNumbersGrounded(section: GeneratedSection, allowed: ReadonlySet<string>): ValidationResult {
  const text = [section.content ?? "", ...qaAsDicts(section).map((q) => q.answer)].join("\n");
  const bad = ungroundedNumbers(text, allowed);
  if (bad.length === 0) return ok();
  return fail(
    `UNGROUNDED_NUMBER: ${bad.slice(0, 8).join(", ")} do not appear in the verified inputs; quote only recorded figures (percent of target is the only derived figure allowed)`,
  );
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
  const allowed = new Set<string>();
  for (const v of verifiedNumbers) allowed.add(normaliseNumber(v));
  for (const art of artifactsAsDicts(section)) {
    if (art.kind !== "CHART") continue;
    const series = (art.payload.series as ReadonlyArray<{ name?: string; data?: ReadonlyArray<unknown> }> | undefined) ?? [];
    for (const s of series) {
      const data = s.data ?? [];
      for (let j = 0; j < data.length; j++) {
        const point = data[j];
        if (point === null || point === undefined || point === "") continue;
        if (!allowed.has(normaliseNumber(String(point)))) {
          return fail(`CHART_UNGROUNDED: series '${s.name ?? "?"}' data[${j}]=${String(point)} not in verified numbers`);
        }
      }
    }
  }
  return ok();
}

export interface MandatoryQuestionsContext {
  mandatoryQuestions: ReadonlyArray<string>;
}

const HONEST_GAP_RE =
  /\b(?:no|not|none)\b[^.]{0,80}?\b(?:recorded|reported|available|collected|captured|documented|verified)\b/i;

function questionKey(text: string): string {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).join(" ");
}

/**
 * Each mandatory question needs a non-empty answer. Matching ignores case and
 * punctuation and falls back to position when every question was answered in
 * order. An honest "not recorded" answer needs no source.
 */
export function assertMandatoryQuestionsAnswered(
  section: GeneratedSection,
  ctx: MandatoryQuestionsContext,
): ValidationResult {
  const questions = ctx.mandatoryQuestions ?? [];
  if (questions.length === 0) return ok();
  const qa = qaAsDicts(section).filter((item) => item.answer.trim().length > 0);
  const byKey = new Map(qa.map((item) => [questionKey(item.question), item]));
  const missing: string[] = [];
  const matched: typeof qa = [];
  questions.forEach((q, i) => {
    const item = byKey.get(questionKey(q)) ?? (qa.length === questions.length ? qa[i] : undefined);
    if (item) matched.push(item);
    else missing.push(q);
  });
  if (missing.length > 0) return fail(`MISSING_QA: ${missing.join(" | ")}`);
  for (let i = 0; i < matched.length; i++) {
    const item = matched[i]!;
    if ((item.sourceReferences ?? []).length < 1 && !HONEST_GAP_RE.test(item.answer)) {
      return fail(`MISSING_QA_SOURCE: answer ${i + 1} has no sourceReferences`);
    }
  }
  return ok();
}

/** A delta is required only when there is both a prior period and a comparable figure. */
export function assertDeltaFromPrior(
  section: GeneratedSection,
  priorNarrativePresent: boolean,
  comparableFindingPresent = true,
): ValidationResult {
  if (!priorNarrativePresent || !comparableFindingPresent) return ok();
  if (section.deltaFromPrior === undefined || section.deltaFromPrior === null) {
    return fail("MISSING_DELTA: deltaFromPrior is required when prior narrative exists");
  }
  return ok();
}

export interface WordCountContext {
  minWords?: number;
  maxWords?: number;
}

/**
 * maxWords is hard; a shortfall against minWords is only a warning (padding to
 * reach a minimum is what produces speculative prose). Tables are not counted.
 */
export function assertWordCount(section: GeneratedSection, ctx: WordCountContext): ValidationResult {
  const count = words(prose(section.content ?? "")).length;
  const issues: string[] = [];
  const warnings: string[] = [];
  if (ctx.minWords !== undefined && count < ctx.minWords) {
    warnings.push(`WORD_LIMIT: ${count} words < minWords=${ctx.minWords} (add only grounded detail; never pad)`);
  }
  if (ctx.maxWords !== undefined && count > ctx.maxWords) {
    issues.push(`WORD_LIMIT: ${count} words > maxWords=${ctx.maxWords}`);
  }
  return { ok: issues.length === 0, issues, warnings };
}

export function assertRepetition(
  section: GeneratedSection,
  priorSummary: ReadonlyArray<string> | undefined,
): ValidationResult {
  if (!priorSummary || priorSummary.length === 0) return ok();
  const split = (text: string) => prose(text).trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  const trigrams = (tokens: string[]) => new Set(tokens.slice(0, Math.max(0, tokens.length - 2)).map((_, i) => tokens.slice(i, i + 3).join(" ")));
  const newSents = split(section.content ?? "");
  const priorTokens = priorSummary.flatMap((blob) => split(String(blob))).map(normaliseTokens).filter((t) => t.length > 0);
  if (newSents.length === 0 || priorTokens.length === 0) return ok();
  // Two signals: >=70% token Jaccard (near copies) or >=60% of the sentence's
  // word trigrams contained in a sibling sentence (paraphrases). Short
  // sentences (<8 tokens) are ignored.
  for (const ns of newSents) {
    const nsList = normaliseTokens(ns);
    if (nsList.length < 8) continue;
    const nsTokens = new Set(nsList);
    const nsTri = trigrams(nsList);
    for (const psList of priorTokens) {
      const psTokens = new Set(psList);
      const intersection = [...nsTokens].filter((t) => psTokens.has(t)).length;
      const jaccard = intersection / Math.max(1, new Set([...nsTokens, ...psTokens]).size);
      const psTri = trigrams(psList);
      const contained = nsTri.size === 0 ? 0 : [...nsTri].filter((t) => psTri.has(t)).length / nsTri.size;
      if (jaccard >= 0.7 || contained >= 0.6) return fail(`DUPLICATE: sentence restates a sibling section: "${ns.slice(0, 90)}"`);
    }
  }
  return ok();
}

/** Banned phrases present as whole words/phrases ("permanent staff" is fine). */
export function findBannedPhrases(text: string): string[] {
  const lower = (text ?? "").toLowerCase();
  return BANNED_PHRASES.filter((p) =>
    new RegExp(`(?<![a-z])${p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`).test(lower),
  );
}

export function assertBannedPhrases(section: GeneratedSection): ValidationResult {
  const hits = findBannedPhrases(section.content ?? "");
  if (hits.length > 0) return fail(`BANNED_PHRASE: ${hits.join(", ")}`);
  return ok();
}

export function assertDonorVoice(section: GeneratedSection): ValidationResult {
  return { ok: true, issues: [], warnings: assessDonorVoice(section.content ?? "").warnings };
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
  /** Legacy "every figure restated" check (only for sections that must restate all figures). */
  verifiedNumbers?: ReadonlySet<string>;
  /** Normalised numbers the inputs contain (see `allowedNumbers`); enables the grounding check. */
  allowedNumbers?: ReadonlySet<string>;
  priorNarrativePresent?: boolean;
  /** Whether the section carries a comparable current/previous figure (default true). */
  comparableFindingPresent?: boolean;
  mandatoryQuestions?: ReadonlyArray<string>;
  priorSectionsSummary?: ReadonlyArray<string>;
  /** Synthesis sections (executive summary) summarise siblings; no repetition check. */
  synthesis?: boolean;
  minWords?: number;
  maxWords?: number;
}

export function runAll(section: GeneratedSection, opts: RunAllOptions = {}): ValidationResult {
  const verifiedNumbers = opts.verifiedNumbers ?? new Set<string>();
  const chartAllowed = new Set<string>([...(opts.allowedNumbers ?? []), ...verifiedNumbers]);
  const results: ValidationResult[] = [
    assertNumericExactness(section, verifiedNumbers),
    opts.allowedNumbers ? assertNumbersGrounded(section, opts.allowedNumbers) : ok(),
    assertTableCitation(section),
    assertChartDataGrounding(section, chartAllowed),
    assertMandatoryQuestionsAnswered(section, { mandatoryQuestions: opts.mandatoryQuestions ?? [] }),
    assertDeltaFromPrior(section, opts.priorNarrativePresent === true, opts.comparableFindingPresent ?? true),
    assertWordCount(section, { minWords: opts.minWords, maxWords: opts.maxWords }),
    opts.synthesis ? ok() : assertRepetition(section, opts.priorSectionsSummary ?? []),
    assertBannedPhrases(section),
    assertArtifactOrdering(section),
    assertDonorVoice(section),
  ];
  const issues: string[] = [];
  const warnings: string[] = [];
  for (const r of results) {
    issues.push(...r.issues);
    warnings.push(...(r.warnings ?? []));
  }
  return { ok: issues.length === 0, issues, warnings };
}
