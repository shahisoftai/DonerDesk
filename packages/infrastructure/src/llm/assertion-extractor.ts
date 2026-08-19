import { DomainError } from "@donordesk/domain";
import {
  extractNumericAtoms,
  classifyNumericAtomRoles,
  stableFingerprint,
  defaultMaterialityFor,
  type Assertion,
  type AssertionType,
} from "@donordesk/domain";
import type { IAssertionExtractor, AssertionExtractionInput } from "@donordesk/application";

interface Sentence {
  text: string;
  start: number;
  end: number;
}

const HEADING_RE = /^#{1,6}\s+/;
const ALL_CAPS_HEADING_RE = /^[A-Z][A-Z\s]{4,}$/;
const CITATION_MARKER_RE = /^\[(needs verification|needs source verification|insert|citation)[^\]]*\]$/i;
const BULLET_RE = /^[-*•]\s+/;

const CAUSAL_RE = /\b(caused|led to|resulted in|due to|owing to|because of|has driven|contributed to|as a result of|impact on|effect on)\b/i;
const COMPLIANCE_RE = /\b(complies?|in accordance with|in line with|safeguarding|psea|protection from sexual|do no harm|per (the|our) policy|mandatory|obligation|incident|complaint|fraud|breach|budget|expenditure|underspend|overspend|value for money|commitment|covenant|declaration|visibility requirement)\b/i;
const FORECAST_RE = /\b(expected to|will reach|projected to|is projected|forecast(ed)? to|is anticipated to)\b/i;
const RECOMMENDATION_RE = /\b(recommend(s|ed)?|should ensure|should strengthen|suggest(s|ed)?)\b/i;
const DATE_RE = /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(tember)?|oct(ober)?|nov(ember)?|dec(ember)?)\s+\d{1,2}(\s*,?\s*\d{4})?\b/i;
const ENTITY_RE = /\b(UN|USAID|BHA|EU|ECHO|Gavi|GFATM|ministry|government|organization|partner|committee)\b/i;
const TARGET_PERFORMANCE_RE = /\b(against the target|target progress|target was|achieved .{0,20} target|on track to (meet|reach) the target)\b/i;

function splitSentences(text: string): Sentence[] {
  const result: Sentence[] = [];
  const re = /[.!?]+(\s+|$)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const rawStart = cursor;
    const rawEnd = match.index + match[0].length;
    const raw = text.slice(rawStart, rawEnd);
    const trimmed = raw.trim();
    if (trimmed.length >= 3) {
      const lead = raw.length - raw.trimStart().length;
      result.push({ text: trimmed, start: rawStart + lead, end: rawEnd - (raw.length - raw.trimEnd().length) });
    }
    cursor = rawEnd;
  }
  if (cursor < text.length) {
    const raw = text.slice(cursor);
    const trimmed = raw.trim();
    if (trimmed.length >= 3) {
      const lead = raw.length - raw.trimStart().length;
      result.push({ text: trimmed, start: cursor + lead, end: cursor + lead + trimmed.length });
    }
  }
  return result;
}

function classifyAssertionType(text: string, hasNumbers: boolean): AssertionType {
  if (hasNumbers) return "NUMERIC";
  if (CAUSAL_RE.test(text)) return "CAUSAL";
  if (COMPLIANCE_RE.test(text) || TARGET_PERFORMANCE_RE.test(text)) return "COMPLIANCE_DECLARATION";
  if (FORECAST_RE.test(text)) return "FORECAST";
  if (RECOMMENDATION_RE.test(text)) return "RECOMMENDATION";
  if (DATE_RE.test(text) || ENTITY_RE.test(text)) return "FACTUAL";
  return "QUALITATIVE";
}

function isSkippableSentence(sentence: string): boolean {
  if (sentence.length < 3) return true;
  if (HEADING_RE.test(sentence)) return true;
  if (ALL_CAPS_HEADING_RE.test(sentence) && sentence.length <= 60) return true;
  if (CITATION_MARKER_RE.test(sentence)) return true;
  return false;
}

/**
 * Deterministic assertion extractor. Splits the final normalized content into
 * sentences, classifies each as a typed assertion, extracts numeric atoms with
 * semantic roles, and reconciles writer-provided claims so an empty or
 * incomplete claims array can never bypass the assurance pipeline.
 *
 * A deterministic extractor guarantees no hidden LLM dependency in the
 * critical path; an LLM-backed extractor can be added behind the same port.
 */
export class DeterministicAssertionExtractor implements IAssertionExtractor {
  async extract(input: AssertionExtractionInput): Promise<{ ok: true; value: Assertion[] } | { ok: false; error: DomainError }> {
    try {
      const content = input.content ?? "";
      const sentences = splitSentences(content).filter((s) => !isSkippableSentence(s.text));
      const assertions: Assertion[] = [];

      for (const sentence of sentences) {
        const numbers = extractNumericAtoms(sentence.text);
        const offsetAtoms = classifyNumericAtomRoles(sentence.text, numbers).map((atom) => ({
          ...atom,
          charStart: atom.charStart + sentence.start,
          charEnd: atom.charEnd + sentence.start,
        }));
        const type = classifyAssertionType(sentence.text, numbers.length > 0);
        const fingerprint = stableFingerprint(sentence.text);

        const writer = input.writerClaims.find((c) => stableFingerprint(c.text) === fingerprint);

        const assertion: Assertion = {
          id: fingerprint,
          text: sentence.text,
          type: writer ? mapWriterType(writer.type) : type,
          charStart: sentence.start,
          charEnd: sentence.end,
          materiality: defaultMaterialityFor(writer ? mapWriterType(writer.type) : type, offsetAtoms.length > 0),
          numericAtoms: offsetAtoms,
          sources: writer
            ? writer.proposedSources.map((s) => ({ evidenceId: s.evidenceId, chunkId: s.chunkId, sourceText: s.sourceText }))
            : [],
          extractionOrigin: writer ? "WRITER" : "DETERMINISTIC",
        };
        assertions.push(assertion);
      }

      // Writer claims that are verbatim in the content but did not map to a
      // sentence (multi-sentence or differently-punctuated wording) still enter
      // the pipeline so writer verification cannot silently disappear.
      const matched = new Set(assertions.map((a) => a.id));
      const normalizedContent = content.replace(/\s+/g, " ").trim().toLowerCase();
      for (const claim of input.writerClaims) {
        const fingerprint = stableFingerprint(claim.text);
        if (matched.has(fingerprint)) continue;
        const index = normalizedContent.indexOf(claim.text.replace(/\s+/g, " ").trim().toLowerCase());
        if (index === -1) continue;
        const start = index;
        const end = start + claim.text.replace(/\s+/g, " ").trim().length;
        const numbers = extractNumericAtoms(claim.text).map((atom) => ({ ...atom, charStart: atom.charStart + start, charEnd: atom.charEnd + start }));
        const type = mapWriterType(claim.type);
        assertions.push({
          id: fingerprint,
          text: claim.text,
          type,
          charStart: start,
          charEnd: end,
          materiality: defaultMaterialityFor(type, numbers.length > 0),
          numericAtoms: numbers,
          sources: claim.proposedSources.map((s) => ({ evidenceId: s.evidenceId, chunkId: s.chunkId, sourceText: s.sourceText })),
          extractionOrigin: "WRITER",
        });
      }

      assertions.sort((a, b) => a.charStart - b.charStart);
      return { ok: true, value: assertions };
    } catch (error) {
      return {
        ok: false,
        error: DomainError.invariant(`Assertion extraction failed: ${error instanceof Error ? error.message : String(error)}`),
      };
    }
  }
}

function mapWriterType(type: string): AssertionType {
  switch (type) {
    case "NUMERIC":
      return "NUMERIC";
    case "CAUSAL":
      return "CAUSAL";
    case "QUALITATIVE":
      return "QUALITATIVE";
    default:
      return "FACTUAL";
  }
}
