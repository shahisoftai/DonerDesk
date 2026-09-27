import type { DocumentBlock } from "@donordesk/application";
import type { RequiredTable, SectionInputType } from "@donordesk/domain";

const PLACEHOLDER = /^[[(<{]\s*(?:insert|write|enter|add|type|paste|provide|list|describe|attach|text|click|max(?:imum)?\.?)[^\])>}]*[\])>}]\.?$/i;
const IMPERATIVE = /^(?:please\s+)?(describe|explain|provide|list|outline|summari[sz]e|indicate|specify|report(?:\s+on)?|detail|discuss|analy[sz]e|identify|highlight|include|state|present|give|share|elaborate|mention|clarify|justify|reflect|assess|note|document|confirm|attach|upload|what|how|why|which|where|when|who|has|have|did|does|do|is|are|were|was)\b/i;
const MIN_WORDS = /min(?:imum)?\.?\s*(?:of\s*)?(\d[\d,]*)\s*words?/i;
const MAX_WORDS = /(?:max(?:imum)?\.?|up\s+to|no\s+more\s+than|not\s+(?:to\s+)?exceed|limit(?:ed)?\s+to)\s*(?:of\s*)?(\d[\d,]*)\s*words?/i;
const RANGE_WORDS = /(\d[\d,]*)\s*(?:-|–|to)\s*(\d[\d,]*)\s*words?/i;
const PAGE_LIMIT = /(?:max(?:imum)?\.?|up\s+to|no\s+more\s+than|not\s+(?:to\s+)?exceed|limit(?:ed)?\s+to)\s*(?:of\s*)?(\d{1,3})\s*pages?/i;
const EVIDENCE = /(?:evidence(?:s)?\s*(?:needed|required)?|supporting\s+(?:evidence|documents?|documentation)|means\s+of\s+verification|sources?\s+of\s+verification)\s*[:\-–]\s*(.+)$/i;
const OPTIONAL = /\b(optional|if\s+applicable|where\s+applicable|where\s+relevant|if\s+relevant|as\s+appropriate|not\s+mandatory)\b/i;
const MANDATORY = /\b(mandatory|required\s+section|must\s+be\s+(?:completed|included|provided)|is\s+required|compulsory)\b/i;
const INDICATOR_COLUMNS = /\b(indicator|baseline|target|actual|achieved|means\s+of\s+verification|result)\b/i;

export interface SectionAnalysis {
  instructions?: string;
  description: string;
  mandatoryQuestions: string[];
  evidenceNeeded: string[];
  requiredTables: RequiredTable[];
  minWords?: number;
  maxWords?: number;
  pageLimit?: number;
  required: boolean;
  inputType: SectionInputType;
  /** Plain text of the section's guidance, for requirement scanning. */
  text: string;
}

const BOILERPLATE_PREFIX = /^(?:instructions?|guidance|guidelines?)\s*[:\-–]\s*/i;
const INPUT_TYPE_PHRASE = /\bprovide\s+(?:a\s+|an\s+)?(?:narrative|table|indicator\s+table|annex|compliance)\b\s*/i;

/** Table-cell debris and blank-field lines ("Baseline", "Name: ______"). */
function isDebris(text: string): boolean {
  if (/_{3,}|\.{5,}/.test(text) && text.replace(/[_.:\s]/g, "").length < 40) return true;
  return !/\s/.test(text) && text.length <= 24;
}

/** Drops "Instructions:" labels and the input-type phrase (captured as inputType). */
function cleanSentence(sentence: string): string | undefined {
  const cleaned = stripLimitsText(sentence.replace(BOILERPLATE_PREFIX, "").replace(INPUT_TYPE_PHRASE, "")).trim();
  return /[A-Za-z\u00c0-\u024f\u0600-\u06ff]{3}/.test(cleaned) ? cleaned : undefined;
}

function num(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v.replace(/,/g, ""));
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.?!])\s+(?=[A-Z("'“])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const NOT_A_QUESTION = /^(?:(?:please\s+)?note\b|n\.b\.|provide\s+(?:a\s+|an\s+)?(?:narrative|table|indicator\s+table|annex|compliance)\b[^.]{0,20}\.?$)/i;
const MAX_QUESTIONS = 15;

export function isQuestion(sentence: string): boolean {
  const s = sentence.trim();
  if (s.length < 12 || s.length > 600 || NOT_A_QUESTION.test(s)) return false;
  return /\?$/.test(s) || IMPERATIVE.test(s);
}

export function wordLimits(text: string): { minWords?: number; maxWords?: number } {
  const range = RANGE_WORDS.exec(text);
  let minWords = range ? num(range[1]) : num(MIN_WORDS.exec(text)?.[1]);
  let maxWords = range ? num(range[2]) : num(MAX_WORDS.exec(text)?.[1]);
  if (maxWords !== undefined && maxWords <= 0) maxWords = undefined;
  if (minWords !== undefined && maxWords !== undefined && minWords > maxWords) minWords = undefined;
  return { minWords, maxWords };
}

function stripLimitsText(text: string): string {
  return text
    .replace(/\(?\s*(?:min(?:imum)?\.?\s*(?:of\s*)?\d[\d,]*\s*words?|(?:max(?:imum)?\.?|up\s+to|no\s+more\s+than)\s*(?:of\s*)?\d[\d,]*\s*(?:words?|pages?)|\d[\d,]*\s*(?:-|–|to)\s*\d[\d,]*\s*words?)\s*\)?[.,;]?/gi, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function inferInputType(title: string, text: string, tables: RequiredTable[]): SectionInputType {
  const explicit = /provide\s+(?:a\s+|an\s+)?(narrative|table|indicator\s+table|annex|compliance)/i.exec(text);
  if (explicit?.[1]) {
    const kind = explicit[1].toLowerCase().replace(/\s+/g, "_");
    if (kind === "indicator_table") return "INDICATOR_TABLE";
    if (kind === "compliance") return "COMPLIANCE";
    if (kind === "annex") return "ANNEX";
    if (kind === "table") return "TABLE";
    return "NARRATIVE";
  }
  const t = title.toLowerCase();
  const all = `${t} ${text.toLowerCase()}`;
  if (/^(annex|appendix|attachment)\b/.test(t) || /\b(annexes|attachments|appendices|supporting documents)\b/.test(t)) return "ANNEX";
  const indicatorTable = tables.some((tb) => tb.columns.filter((c) => INDICATOR_COLUMNS.test(c)).length >= 2);
  if (indicatorTable || (/\bindicator/.test(t) && /\b(table|baseline|target|actual)\b/.test(all))) return "INDICATOR_TABLE";
  if (/\b(compliance|safeguard|psea|do no harm|code of conduct)\b/.test(t)) return "COMPLIANCE";
  if (tables.length > 0 && text.replace(/\s+/g, " ").length < 200) return "TABLE";
  if (/\b(budget|expenditure|financial report|beneficiary (?:figures|numbers|table))\b/.test(t) && /\btable\b/.test(all)) return "TABLE";
  return "NARRATIVE";
}

function tableTitle(caption: string | undefined, fallback: string, index: number): string {
  const c = caption?.replace(/[:.]\s*$/, "").trim();
  if (c && /^(table|figure|matrix)\b/i.test(c) && c.length <= 200) return c;
  return index === 0 ? `${fallback} table` : `${fallback} table ${index + 1}`;
}

/**
 * Reads a section's body blocks into what the donor asks for: verbatim
 * instructions, explicit questions, evidence, required tables, limits.
 */
export function analyzeSection(title: string, blocks: readonly DocumentBlock[]): SectionAnalysis {
  const instructionParts: string[] = [];
  const questions: string[] = [];
  const evidence: string[] = [];
  const tables: RequiredTable[] = [];
  const textParts: string[] = [];
  let lastCaption: string | undefined;

  const takeEvidence = (sentence: string): boolean => {
    const m = EVIDENCE.exec(sentence);
    if (!m?.[1]) return false;
    evidence.push(...m[1].split(/[;,]|\band\b/).map((x) => x.replace(/[.\s]+$/, "").trim()).filter((x) => x.length > 2));
    return true;
  };

  for (const b of blocks) {
    if (b.kind === "TABLE") {
      const header = b.rows[0]?.map((c) => c.trim()).filter(Boolean) ?? [];
      if (header.length > 0) tables.push({ title: tableTitle(lastCaption, title, tables.length), columns: header });
      lastCaption = undefined;
      continue;
    }
    if (b.kind === "HEADING") continue;
    const text = b.text.trim();
    if (!text || PLACEHOLDER.test(text) || isDebris(text)) continue;
    textParts.push(text);
    if (/^(table|figure|matrix)\s*[\dA-Z]*\s*[:.\-–]/i.test(text) && text.length <= 200) {
      lastCaption = text;
      continue;
    }
    if (b.kind === "LIST_ITEM") {
      if (takeEvidence(text)) continue;
      if (isQuestion(text)) questions.push(text);
      else instructionParts.push(`- ${text}`);
      continue;
    }
    const kept: string[] = [];
    for (const raw of splitSentences(text)) {
      const sentence = cleanSentence(raw);
      if (!sentence) continue;
      if (takeEvidence(sentence)) continue;
      if (PLACEHOLDER.test(sentence)) continue;
      if (sentence.length <= 400 && isQuestion(sentence)) questions.push(sentence);
      else kept.push(sentence);
    }
    if (kept.length) instructionParts.push(kept.join(" "));
  }

  const text = textParts.join("\n");
  const { minWords, maxWords } = wordLimits(text);
  const pageLimit = num(PAGE_LIMIT.exec(text)?.[1]) || undefined;
  const instructions = stripLimitsText(instructionParts.join("\n"))
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== "-" && !/^-\s*$/.test(l))
    .join("\n");
  const cleanQuestions = [...new Set(questions.map((q) => stripLimitsText(q)).filter((q) => q.length >= 12))].slice(0, MAX_QUESTIONS);
  // List items describe sub-items (e.g. one optional annex), not the section itself.
  const ownText = blocks.filter((b) => b.kind === "PARAGRAPH").map((b) => (b as { text: string }).text).join(" ");
  const optional = OPTIONAL.test(`${title} ${ownText}`) && !/not\s+optional/i.test(ownText);
  const required = MANDATORY.test(ownText) || !optional;
  const summary = splitSentences(instructions.replace(/^- /gm, ""))[0] ?? "";
  return {
    instructions: instructions || undefined,
    description: summary.length > 300 ? `${summary.slice(0, 297)}…` : summary,
    mandatoryQuestions: cleanQuestions,
    evidenceNeeded: [...new Set(evidence)],
    requiredTables: tables,
    minWords,
    maxWords,
    pageLimit,
    required,
    inputType: inferInputType(title, text, tables),
    text,
  };
}
