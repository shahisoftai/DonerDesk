/**
 * Ask DonorDesk (Phase 33.9): a question put to a project's own records. The records are cut into short numbered sources; the
 * model may answer only from those sources and must name the source of every sentence. Everything it writes is then checked
 * here, deterministically: a sentence that names no real source is dropped, a sentence with a figure that is not in the sources it
 * names is dropped, and what could not be answered is said, never guessed. Pure: no model call, no clock, no storage.
 */
import { tryParseJson } from "../../core/json-repair.js";
import type { DataSheet } from "../reporting/data-sheet.js";

export type AskSourceKind = "PROJECT" | "INDICATOR" | "ACTIVITY" | "EVIDENCE";

export interface AskSource {
  /** The short id the model cites ("S1"); assigned after selection. */
  id: string;
  kind: AskSourceKind;
  /** What a person sees beside a citation ("Indicator OUT-1", "Evidence: Attendance sheet"). */
  label: string;
  text: string;
  /** Where the record stands, for evidence and values ("Verified", "Not yet verified"). */
  status?: string | undefined;
}

export type AskCandidate = Omit<AskSource, "id">;

const clip = (text: string, max: number): string => {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

export interface AskProjectFacts {
  title: string;
  projectCode?: string | undefined;
  donorName?: string | undefined;
  country?: string | undefined;
  sector?: string | undefined;
  start?: string | undefined;
  end?: string | undefined;
  description?: string | undefined;
}

export function projectCandidate(p: AskProjectFacts): AskCandidate {
  const parts = [`Project "${p.title}"`, p.projectCode ? `code ${p.projectCode}` : "", p.donorName ? `donor ${p.donorName}` : "", p.country ? `in ${p.country}` : "", p.sector ? `sector ${p.sector}` : "", p.start && p.end ? `from ${p.start} to ${p.end}` : ""].filter(Boolean);
  return { kind: "PROJECT", label: "The project", text: clip(`${parts.join(", ")}.${p.description ? ` ${p.description}` : ""}`, 600) };
}

/** One source per indicator: its definition and every value recorded for it, with whether each is verified. */
export function indicatorCandidates(sheet: DataSheet): AskCandidate[] {
  const cells = new Map<string, DataSheet["cells"]>();
  for (const c of sheet.cells) cells.set(c.indicatorId, [...(cells.get(c.indicatorId) ?? []), c]);
  const periodOf = new Map(sheet.periods.map((p) => [p.id, p]));
  return sheet.indicators.map((i) => {
    const head = `Indicator ${i.code} "${i.name}"${i.unit ? ` (${i.unit})` : ""}: baseline ${i.baseline || "none set"}, target ${i.target || "none set"}.`;
    const values = (cells.get(i.id) ?? [])
      .filter((c) => !c.notApplicable && (c.periodValue !== "" || c.cumulativeValue !== ""))
      .sort((a, b) => (periodOf.get(a.periodId)?.start ?? "").localeCompare(periodOf.get(b.periodId)?.start ?? ""))
      .map((c) => {
        const p = periodOf.get(c.periodId);
        const bits = [c.periodValue !== "" ? `period value ${c.periodValue}` : "", c.cumulativeValue !== "" ? `cumulative ${c.cumulativeValue}` : ""].filter(Boolean).join(", ");
        return `${p?.label ?? "a period"}: ${bits}${c.status === "VERIFIED" ? " (verified)" : " (not yet verified)"}`;
      });
    const text = values.length > 0 ? `${head} Recorded values: ${values.join("; ")}.` : `${head} No value has been recorded yet.`;
    return { kind: "INDICATOR" as const, label: `Indicator ${i.code}`, text: clip(text, 1400), status: values.length === 0 ? "No values" : undefined };
  });
}

export interface AskActivityFacts { title: string; date?: string | undefined; location?: string | undefined; summary?: string | undefined; participants?: number | undefined }

export function activityCandidates(activities: ReadonlyArray<AskActivityFacts>): AskCandidate[] {
  return activities.map((a) => ({
    kind: "ACTIVITY" as const,
    label: `Activity: ${clip(a.title, 60)}`,
    text: clip(`Activity "${a.title}"${a.date ? ` on ${a.date}` : ""}${a.location ? ` in ${a.location}` : ""}${a.participants !== undefined ? `, ${a.participants} participants` : ""}.${a.summary ? ` ${a.summary}` : ""}`, 700),
  }));
}

export interface AskEvidenceFacts { title: string; text?: string | undefined; verified: boolean }

/** Evidence text is cut into short pieces so only the relevant ones travel to the model. */
export function evidenceCandidates(files: ReadonlyArray<AskEvidenceFacts>, pieceLength = 650, maxPieces = 6): AskCandidate[] {
  const out: AskCandidate[] = [];
  for (const f of files) {
    const body = (f.text ?? "").replace(/\s+/g, " ").trim();
    if (!body) continue;
    for (let i = 0, n = 0; i < body.length && n < maxPieces; i += pieceLength, n += 1) {
      out.push({ kind: "EVIDENCE", label: `Evidence: ${clip(f.title, 60)}`, text: body.slice(i, i + pieceLength), status: f.verified ? "Verified" : "Not yet verified" });
    }
  }
  return out;
}

const STOP = new Set(["the", "and", "for", "are", "was", "were", "how", "many", "much", "what", "which", "who", "when", "where", "why", "did", "does", "has", "have", "had", "with", "from", "that", "this", "these", "those", "about", "into", "than", "then", "there", "their", "been", "being", "can", "could", "would", "should", "tell", "show", "give", "please", "any", "all", "our", "your", "its"]);
const fold = (text: string): string => text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const questionTerms = (question: string): string[] => [...new Set(fold(question).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t)))];

export interface SelectOptions { limit?: number; maxChars?: number }

/**
 * Picks the sources worth sending: those that share words with the question (a source whose indicator code is named ranks first),
 * best first, within a size budget. The project source always goes. With nothing relevant only the project source remains, and
 * the answer will say the records do not cover the question.
 */
export function selectSources(question: string, candidates: ReadonlyArray<AskCandidate>, options: SelectOptions = {}): AskSource[] {
  const limit = options.limit ?? 14;
  const budget = options.maxChars ?? 9000;
  const terms = questionTerms(question);
  const q = fold(question);
  const scored = candidates.map((c, index) => {
    const haystack = fold(`${c.label} ${c.text}`);
    const labelHay = fold(c.label);
    let score = 0;
    for (const t of terms) {
      if (labelHay.includes(t)) score += 2;
      else if (haystack.includes(t)) score += 1;
    }
    const code = /^Indicator (\S+)/.exec(c.label)?.[1];
    if (code && new RegExp(`(^|[^a-z0-9])${fold(code).replace(/[^a-z0-9]/g, "[^a-z0-9]?")}($|[^a-z0-9])`).test(q)) score += 6;
    return { c, index, score };
  });
  const project = scored.filter((s) => s.c.kind === "PROJECT");
  const relevant = scored.filter((s) => s.c.kind !== "PROJECT" && s.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);
  const chosen: typeof scored = [...project];
  let used = project.reduce((n, s) => n + s.c.text.length, 0);
  for (const s of relevant) {
    if (chosen.length >= limit || used + s.c.text.length > budget) continue;
    chosen.push(s);
    used += s.c.text.length;
  }
  return chosen.map((s, i) => ({ ...s.c, id: `S${i + 1}` }));
}

export function buildAskPrompt(question: string, sources: ReadonlyArray<AskSource>): { system: string; user: string } {
  return {
    system:
      "You answer a question about a humanitarian project using ONLY the numbered sources given. " +
      "Write short plain sentences. After EVERY sentence list the ids of the sources that state it. " +
      "Quote a number exactly as the source writes it; never add, subtract, average, round, estimate or convert numbers. " +
      "Say a value is not yet verified when the source says so. Do not explain causes or impact unless a source does. " +
      "If the sources do not answer the question, or only part of it, say what is missing in \"missing\" and do not guess. " +
      'Reply with JSON only: {"answer":[{"text":"one sentence","sources":["S1"]}],"missing":["what the sources do not tell"]}.',
    user: `Question: ${question.trim()}\n\nSources:\n${sources.map((s) => `[${s.id}] ${s.label}${s.status ? ` (${s.status})` : ""}: ${s.text}`).join("\n")}`,
  };
}

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;
/** Numbers in a text in one canonical spelling: "1,200" and "1200.0" are the same figure. */
export function askFigures(text: string): string[] {
  return [...text.matchAll(NUMBER)].map((m) => {
    const n = Number(m[0].replace(/,/g, ""));
    return Number.isFinite(n) ? String(n) : m[0];
  });
}

export interface AskSentence {
  text: string;
  sources: Array<{ id: string; label: string; kind: AskSourceKind; status?: string | undefined }>;
}

export interface AskAnswer {
  status: "ANSWERED" | "NOT_FOUND";
  sentences: AskSentence[];
  /** What the records do not tell, as the model said it (checked for figures like any sentence). */
  missing: string[];
  /** Sentences left out and why, so a reviewer can see the check at work. */
  dropped: { uncited: number; ungrounded: number };
}

export const NOT_FOUND_SENTENCE = "The project's records do not answer this question.";

/**
 * Checks the model's reply against the sources it was given. A sentence stays only if it names at least one real source and every
 * figure in it appears in the sources it names. Nothing is rewritten and nothing is added: what survives is exactly what the model
 * wrote. With no sentence left the answer is NOT_FOUND.
 */
export function groundAnswer(raw: string, sources: ReadonlyArray<AskSource>): AskAnswer {
  const start = raw.indexOf("{");
  let parsed: unknown;
  if (start >= 0) {
    const end = raw.lastIndexOf("}");
    parsed = end > start ? tryParseJson(raw.slice(start, end + 1)) : undefined;
    if (parsed === undefined) parsed = tryParseJson(raw.slice(start));
  }
  const obj = (parsed && typeof parsed === "object" ? parsed : {}) as { answer?: unknown; missing?: unknown };
  const byId = new Map(sources.map((s) => [s.id, s]));
  const everyFigure = new Set(sources.flatMap((s) => askFigures(s.text)));
  let uncited = 0;
  let ungrounded = 0;
  const sentences: AskSentence[] = [];
  for (const item of Array.isArray(obj.answer) ? obj.answer : []) {
    const entry = item as { text?: unknown; sources?: unknown };
    const text = typeof entry.text === "string" ? entry.text.replace(/\s+/g, " ").trim() : "";
    if (!text || text.length > 400) continue;
    const cited = [...new Set((Array.isArray(entry.sources) ? entry.sources : []).filter((x): x is string => typeof x === "string").map((x) => x.trim().toUpperCase()))]
      .map((id) => byId.get(id))
      .filter((s): s is AskSource => s !== undefined);
    if (cited.length === 0) { uncited += 1; continue; }
    const allowed = new Set(cited.flatMap((s) => askFigures(s.text)));
    if (askFigures(text).some((f) => !allowed.has(f))) { ungrounded += 1; continue; }
    if (sentences.length < 8) sentences.push({ text, sources: cited.map((s) => ({ id: s.id, label: s.label, kind: s.kind, status: s.status })) });
  }
  const missing = (Array.isArray(obj.missing) ? obj.missing : [])
    .filter((m): m is string => typeof m === "string")
    .map((m) => m.replace(/\s+/g, " ").trim())
    .filter((m) => m && m.length <= 240 && askFigures(m).every((f) => everyFigure.has(f)))
    .slice(0, 3);
  return { status: sentences.length > 0 ? "ANSWERED" : "NOT_FOUND", sentences, missing, dropped: { uncited, ungrounded } };
}
