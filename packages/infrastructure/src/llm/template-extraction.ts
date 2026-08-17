import type { ITemplateExtractionService } from "@donordesk/application";
import type { TemplateSection } from "@donordesk/domain";
import { createSection } from "@donordesk/domain";

const CANONICAL: Array<{ title: string; description: string; inputType: "NARRATIVE" | "TABLE" | "ANNEX" | "INDICATOR_TABLE" | "COMPLIANCE"; required: boolean; evidenceNeeded: string; reviewStatus: "REVIEWED"; minWords?: number; maxWords?: number }> = [
  { title: "Executive Summary", description: "Overview of the reporting period.", inputType: "NARRATIVE", required: true, evidenceNeeded: "Activity summaries", reviewStatus: "REVIEWED", minWords: 200, maxWords: 400 },
  { title: "Project Progress", description: "Status of activities vs. plan.", inputType: "NARRATIVE", required: true, evidenceNeeded: "Activity updates", reviewStatus: "REVIEWED", minWords: 400, maxWords: 600 },
  { title: "Indicator Progress", description: "Indicator table with achievements against baselines, targets, and actuals.", inputType: "INDICATOR_TABLE", required: true, evidenceNeeded: "Indicator data", reviewStatus: "REVIEWED", minWords: 100, maxWords: 300 },
  { title: "Achievements", description: "Key achievements of the period.", inputType: "NARRATIVE", required: true, evidenceNeeded: "Verified evidence", reviewStatus: "REVIEWED", minWords: 200, maxWords: 500 },
  { title: "Challenges", description: "Challenges encountered and mitigation.", inputType: "NARRATIVE", required: true, evidenceNeeded: "Field reports", reviewStatus: "REVIEWED", minWords: 200, maxWords: 500 },
  { title: "Lessons Learned", description: "Insights and adaptations.", inputType: "NARRATIVE", required: false, evidenceNeeded: "", reviewStatus: "REVIEWED", minWords: 100, maxWords: 300 },
  { title: "Risks & Mitigation", description: "Top risks and mitigation steps.", inputType: "NARRATIVE", required: false, evidenceNeeded: "Risk register", reviewStatus: "REVIEWED", minWords: 100, maxWords: 300 },
  { title: "Beneficiary Reach", description: "Disaggregation by sex, age, disability.", inputType: "TABLE", required: true, evidenceNeeded: "Attendance sheets, distribution lists", reviewStatus: "REVIEWED", minWords: 100, maxWords: 300 },
  { title: "Annex List", description: "List of attached supporting documents.", inputType: "ANNEX", required: true, evidenceNeeded: "All verified evidence", reviewStatus: "REVIEWED", minWords: 20, maxWords: 100 },
];

const HEADING_RE = /^(?:\d+\.?\s*|\(\d+\)\s*|\b(?:section|chapter|part|annex)\b[\s\d]*|[IVX]+[.)]?\s+)/i;
const UPPER_TITLE_RE = /^[A-Z][A-Z\s&\-/]{4,}$/;
const MIN_WORDS_RE = /min(?:imum)?[:\s]+(\d[\d,]*)/i;
const MAX_WORDS_RE = /max(?:imum)?[:\s]+(\d[\d,]*)/i;
const EVIDENCE_RE = /(?:evidence[s]?\s*needed|supporting\s+(?:evidence|documentation)|evidence\s*)[:\-]\s*([^\n.]+)/i;
const PLACEHOLDER_RE = /^\[(?:write|insert|list|table|paste)[^\]]*\]$/i;
const TABLE_SCAFFOLD_RE = /^(?:item|indicator|table|column|row)\s*\|/i;
const TABLE_CELL_TOKENS = new Set([
  "indicator", "baseline", "target", "actual", "unit", "status",
  "item", "detail", "quantity", "evidence", "total", "disaggregation",
  "sex", "age", "disability", "value", "note", "remarks",
]);

function isTableCellLine(line: string): boolean {
  // Mammoth renders each table cell on its own line (single token). Skip
  // single-token lines that are either known header tokens or part of a run
  // of consecutive single-token lines (data cells).
  const token = line.trim();
  if (!token || /\s/.test(token) || token.length > 40 || /[.!?:;]$/.test(token)) return false;
  return TABLE_CELL_TOKENS.has(token.toLowerCase());
}

function cleanTitle(line: string): string {
  return line
    .replace(/^(?:\d+\.?\s*|\(\d+\)\s*|[IVX]+[.)]?\s+|\b(?:section|chapter|part|annex)\b[\s\d]*:?\s*)/i, "")
    .replace(/:$/g, "")
    .trim();
}

function inferInputType(title: string, guidance: string): TemplateSection["inputType"] {
  // 1) Explicit instruction in the template guidance wins (e.g. "provide a
  //    narrative", "provide an indicator table").
  const explicit = guidance.match(/provide\s+(?:a\s+|an\s+)?(narrative|table|indicator\s+table|annex|compliance)/i);
  if (explicit && explicit[1]) {
    const kind = explicit[1].toLowerCase().replace(/\s+/g, "_");
    if (kind === "indicator_table") return "INDICATOR_TABLE";
    if (kind === "compliance") return "COMPLIANCE";
    if (kind === "annex") return "ANNEX";
    if (kind === "table") return "TABLE";
    return "NARRATIVE";
  }
  // 2) Title and guidance heuristics for templates without explicit hints.
  const text = `${title} ${guidance}`.toLowerCase();
  const mentionsTable = /\btable\b|\btabular\b|\bmatrix\b/.test(text);
  const mentionsIndicator = /\bindicator/.test(title.toLowerCase()) || /\bperformance against\b/.test(text) || /\bresults framework\b/.test(text);
  const mentionsData = /\bbaseline\b|\btarget\b|\bactual\b/.test(text);
  const titleHint = title.toLowerCase();
  const titleTableHint =
    /\bbeneficiar\b|\boutputs?\b|\bactivities\b|\bfinancial\b|\bbudget\b|\bexpenditure\b|\bdisaggregat\b|\btable\b/.test(titleHint);
  if (/\bannex\b|\battachment\b|\bappendix\b/.test(text)) return "ANNEX";
  if (/\bcompliance\b|\bsafeguard\b|\bpsea\b|\bcross[- ]cutting\b|\bprotection\b/.test(text) && !mentionsTable) return "COMPLIANCE";
  if (mentionsIndicator && (mentionsTable || mentionsData)) return "INDICATOR_TABLE";
  if (mentionsTable || titleTableHint) return "TABLE";
  return "NARRATIVE";
}

function inferRequired(title: string, guidance: string, requiredHint: string | undefined): boolean {
  if (requiredHint !== undefined) return requiredHint !== "optional" && requiredHint !== "not required";
  const text = `${title} ${guidance}`.toLowerCase();
  // "optional" wins unless explicitly "not optional"; "as required" in phrases
  // like "photographs as required" must not force a section to be mandatory.
  if (/not\s+optional/.test(text)) return true;
  if (/\boptional\b/.test(text)) return false;
  if (/\bmandatory\b|\brequired\s+section\b|\bmust\s+be\s+included\b|\bis\s+required\b/.test(text)) return true;
  if (/\bannex\b|\bappendix\b|\boptional\b/.test(title.toLowerCase())) return false;
  return true;
}

function parseWordLimits(guidance: string): { minWords?: number; maxWords?: number } {
  const strip = guidance.replace(/[\u2013\u2014-]/g, " ");
  const minMatch = strip.match(MIN_WORDS_RE);
  const maxMatch = strip.match(MAX_WORDS_RE);
  const minWords = minMatch ? Number(minMatch[1]!.replace(/,/g, "")) : undefined;
  const maxWords = maxMatch ? Number(maxMatch[1]!.replace(/,/g, "")) : undefined;
  if (minWords !== undefined && (!Number.isInteger(minWords) || minWords < 0)) return { minWords: undefined, maxWords };
  if (maxWords !== undefined && (!Number.isInteger(maxWords) || maxWords <= 0)) return { minWords, maxWords: undefined };
  if (minWords !== undefined && maxWords !== undefined && minWords > maxWords) return { minWords: undefined, maxWords };
  return { minWords, maxWords };
}

function parseEvidence(guidance: string): string {
  const match = guidance.match(EVIDENCE_RE);
  if (!match || !match[1]) return "";
  return match[1].trim().replace(/\s+/g, " ").replace(/[,;]\s*$/, "");
}

function cleanDescription(guidance: string): string {
  return guidance
    .replace(/^instructions?:?/i, "")
    .replace(/provide\s+(?:a\s+|an\s+)?(?:narrative|table|indicator\s+table|annex|compliance)\s*/i, "")
    .replace(/\(?(?:min(?:imum)?\s*\d[\d,]*\s*words?,?\s*(?:max(?:imum)?\s*\d[\d,]*\s*words?)?|max(?:imum)?\s*\d[\d,]*\s*words?)\)?/gi, "")
    .replace(EVIDENCE_RE, "")
    .replace(/\.\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^[,.;:\s]+|[,.;:\s]+$/g, "");
}

/**
 * Splits raw template text into heading blocks. Each block is the heading line
 * followed by its guidance/instructions until the next heading. The guidance is
 * parsed into description, word limits, evidence needs, and the section type so
 * the review screen can show exactly what the donor asked for.
 */
export class StubTemplateExtractionService implements ITemplateExtractionService {
  async extractSections(input: { rawText: string; language: string; existingSections?: TemplateSection[] }): Promise<{ sections: TemplateSection[]; summary: string }> {
    const raw = input.rawText ?? "";

    // 1) User-supplied existing sections win when regenerating.
    if (input.existingSections && input.existingSections.length > 0) {
      return {
        sections: input.existingSections.map((s) =>
          createSection({ title: s.title, description: s.description, inputType: s.inputType, required: s.required, evidenceNeeded: s.evidenceNeeded, reviewStatus: "REVIEWED", minWords: s.minWords, maxWords: s.maxWords }),
        ),
        summary: `Kept ${input.existingSections.length} existing section(s). Review before saving.`,
      };
    }

    const lines = raw.split(/\r?\n/);
    const blocks: Array<{ title: string; guidance: string[]; rawHeading: string }> = [];
    let current: { title: string; guidance: string[]; rawHeading: string } | undefined;
    let sawTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const trimmed = line.trim();

      const isTableLine = /^\s*\|/.test(line) || /\t/.test(line);
      if (isTableLine || TABLE_SCAFFOLD_RE.test(trimmed)) {
        sawTable = true;
        continue;
      }

      // Headings are short lines that look like a heading number/roman/caps.
      const hasNumbering = HEADING_RE.test(trimmed);
      const upper = UPPER_TITLE_RE.test(trimmed);
      const isHeading =
        (hasNumbering || upper) &&
        trimmed.length <= 140 &&
        !/\s+\d{2,}$/.test(trimmed) &&
        !/^(table|figure|note|source)\b/i.test(trimmed);

      if (isHeading) {
        const title = cleanTitle(trimmed);
        if (title && title.length >= 3) {
          if (current) blocks.push(current);
          current = { title, guidance: [], rawHeading: trimmed };
          continue;
        }
      }

      if (current) {
        if (!trimmed) continue;
        if (PLACEHOLDER_RE.test(trimmed)) continue;
        if (isTableCellLine(trimmed)) {
          sawTable = true;
          continue;
        }
        current.guidance.push(trimmed);
      }
    }
    if (current) blocks.push(current);

    // 2) Detected heading blocks, else the canonical donor outline.
    const base: TemplateSection[] =
      blocks.length > 0
        ? blocks.slice(0, 14).map((block) => {
            const guidance = block.guidance.join(" ").replace(/\s+/g, " ").trim();
            const inputType = inferInputType(block.title, guidance);
            const required = inferRequired(block.title, guidance, undefined);
            const { minWords, maxWords } = parseWordLimits(guidance);
            const evidenceNeeded = parseEvidence(guidance);
            const description = cleanDescription(guidance);
            return createSection({
              title: block.title,
              description,
              inputType,
              required,
              evidenceNeeded,
              minWords,
              maxWords,
              reviewStatus: "REVIEWED",
            });
          })
        : CANONICAL.map((c) => createSection({ ...c }));

    // 3) If the document contained tabular content and no "indicator" section was
    // detected, append an indicator table section so tabular data has a home.
    const hasIndicatorSection = base.some((s) => s.inputType === "INDICATOR_TABLE");
    if (sawTable && !hasIndicatorSection) {
      base.push(
        createSection({
          title: "Indicator Progress",
          description: "Indicator table with achievements against baselines, targets, and actuals.",
          inputType: "INDICATOR_TABLE",
          required: true,
          evidenceNeeded: "Indicator data",
          reviewStatus: "REVIEWED",
          minWords: 100,
          maxWords: 300,
        }),
      );
    }

    const mode = blocks.length > 0 ? "detected" : "canonical";
    const summary = `Extracted ${base.length} section(s) from the template (${input.language}, ${mode}). Review and edit before saving.`;
    return { sections: base, summary };
  }
}
