import { createTemplateRequirements, type ComplianceSeverity, type ReportingFrequency, type TemplateRequirements, type TemplateRequirementsInput } from "@donordesk/domain";
import { splitSentences } from "./content-analyzer.js";

/** What kind of guidance a heading introduces (non-report guidance is kept out of the report). */
export type GuidanceKind = "GENERAL" | "SUBMISSION" | "FORMATTING" | "ANNEXES" | "COMPLIANCE" | "INDICATORS";

const GUIDANCE_HEADINGS: Array<[GuidanceKind, RegExp]> = [
  ["SUBMISSION", /^(submission|submitting|reporting\s+(schedule|deadlines?|timeline|calendar)|deadlines?|due\s+dates?|how\s+to\s+submit)\b/i],
  ["FORMATTING", /^(format(ting)?|presentation|layout|length(\s+and\s+format)?|style\s+guide|report\s+format)\b/i],
  ["GENERAL", /^(general\s+(instructions|guidance|guidelines|notes)|instructions?(\s+for\s+(use|completion|completing))?|guid(e|ance)(s)?(\s+(notes?|for\s+\w+))?|how\s+to\s+(use|complete)|notes?\s+(to|for)\s+(the\s+)?(user|partner|grantee|applicant)s?|purpose\s+of\s+(this|the)\s+(template|document|report(ing)?\s+format)|about\s+this\s+template|introduction\s+to\s+(this|the)\s+template)\b/i],
];

const ANNEX_HEADING = /^(annexes|attachments|appendices|supporting\s+documents|list\s+of\s+(annexes|attachments))\b/i;
const ANNEX_ITEM = /^(?:(?:annex|appendix|attachment)\s*[A-Z\d]{0,3}\s*[:.\-–)]?\s*)(.{2,200})$/i;
const OPTIONAL = /\b(optional|if\s+applicable|where\s+applicable|where\s+relevant|if\s+relevant|if\s+available)\b/i;
const DEADLINE = /within\s+(\d{1,3})\s+(?:calendar\s+|working\s+|business\s+)?days?\s+(?:of|after|following|from)\s+(?:the\s+)?(?:end|close|completion|expiry)/i;
const SUBMISSION_SENTENCE = /\b(submit(?:ted|ting)?|submission|due|deadline|send|upload|e-?mail(?:ed)?\s+to|no\s+later\s+than)\b/i;
const MAX_PAGES = /(?:not\s+(?:to\s+)?exceed|maximum\s+(?:of\s+)?|max\.?\s+|no\s+more\s+than|up\s+to|limited\s+to)\s*(\d{1,3})\s+pages?/i;
const FONT = /\b(Arial|Calibri|Times\s+New\s+Roman|Helvetica|Verdana|Garamond|Cambria|Georgia)\b(?:[^.\n]{0,25}?\b(\d{1,2})\s*(?:pt|points?|-point)?)?/i;
const FORMAT_SENTENCE = /\b(font|pages?|arial|calibri|times\s+new\s+roman|margin|spacing|single-spaced|double-spaced|page\s+numbers?|pdf\s+format|word\s+format|file\s+format|in\s+english|in\s+french|in\s+spanish|in\s+arabic|headers?\s+and\s+footers?|logo|branding|page\s+limit)\b/i;
const COMPLIANCE_TOPIC = /\b(safeguard(?:ing)?|psea|sexual\s+exploitation|fraud|corruption|anti-?terror(?:ism)?|sanction|visibility|branding|logo|emblem|funded\s+by|acknowledg(?:e|ement)|audit|data\s+protection|gdpr|privacy|consent|conflict\s+of\s+interest|do\s+no\s+harm|environment(?:al)?|child\s+protection|code\s+of\s+conduct|whistle-?blow|complaints?|accountability\s+to\s+affected|misconduct|diversion)\b/i;
const OBLIGATION = /\b(must|shall|required|mandatory|obliged|obligation|should|need\s+to|is\s+to\s+be|are\s+to\s+be|prohibited|not\s+permitted)\b/i;
const HARD_OBLIGATION = /\b(will\s+(?:not\s+be\s+accepted|be\s+rejected|be\s+returned)|mandatory|prohibited|not\s+permitted|zero\s+tolerance|must\s+not|shall\s+not)\b/i;
const INDICATOR_SENTENCE = /\bindicators?\b.*\b(disaggregat\w*|baseline|target|means\s+of\s+verification|logframe|log-frame|results\s+framework|cumulative|against)\b/i;
const DISAGG = /disaggregat\w*\s+(?:by|according\s+to|per)\s+([^.;]+)/i;

const FREQUENCIES: Array<[RegExp, ReportingFrequency]> = [
  [/\bmonthly\s+(?:narrative\s+|progress\s+)?report/i, "MONTHLY"],
  [/\bquarterly\s+(?:narrative\s+|progress\s+)?report/i, "QUARTERLY"],
  [/\b(?:semi-?annual|bi-?annual|six-?monthly|interim)\s+(?:narrative\s+|progress\s+)?report/i, "SEMI_ANNUAL"],
  [/\bannual\s+(?:narrative\s+|progress\s+)?report/i, "ANNUAL"],
  [/\bfinal\s+(?:narrative\s+|progress\s+)?report/i, "FINAL"],
];

export function guidanceKindFor(title: string): GuidanceKind | undefined {
  const t = title.trim();
  for (const [kind, re] of GUIDANCE_HEADINGS) if (re.test(t)) return kind;
  return undefined;
}

export function isAnnexHeading(title: string): boolean {
  return ANNEX_HEADING.test(title.trim());
}

function severityOf(sentence: string): ComplianceSeverity {
  if (HARD_OBLIGATION.test(sentence)) return "BLOCK";
  return /\b(must|shall|required)\b/i.test(sentence) ? "WARN" : "INFO";
}

function disaggregation(sentence: string): string[] {
  const m = DISAGG.exec(sentence);
  if (!m?.[1]) return [];
  return m[1]
    .split(/,|\band\b|\bor\b|\//)
    .map((x) => x.replace(/[()]/g, "").trim().toLowerCase())
    .filter((x) => x.length > 1 && x.length < 40);
}

export interface RequirementScanInput {
  documentTitle?: string;
  /** All guidance text in document order, tagged with the heading kind it sat under. */
  /** SECTION = a report section's own guidance (only compliance/indicator rules are lifted); PREFACE = text before the first heading. */
  passages: Array<{ text: string; kind: GuidanceKind | "SECTION" | "PREFACE"; listItems?: string[]; page?: number }>;
  /** Annex names from annex headings and annex-list items. */
  annexCandidates: Array<{ name: string; description?: string }>;
}

/** Scans guidance passages for report-wide requirements. Deterministic and conservative. */
export function analyzeRequirements(input: RequirementScanInput): TemplateRequirements {
  const req: Required<Pick<TemplateRequirementsInput, "annexes" | "indicatorRequirements" | "compliance" | "generalInstructions">> & {
    submission: { instructions: string[]; deadlineRule?: string; deadlineOffsetDays?: number };
    formatting: { rules: string[]; maxPages?: number; font?: string };
  } = { annexes: [], indicatorRequirements: [], compliance: [], generalInstructions: [], submission: { instructions: [] }, formatting: { rules: [] } };
  let frequency: ReportingFrequency | undefined;
  const titleText = input.documentTitle ?? "";
  for (const [re, f] of FREQUENCIES) if (re.test(titleText)) frequency ??= f;

  for (const p of input.passages) {
    const sentences = [...splitSentences(p.text), ...(p.listItems ?? [])];
    for (const s of sentences) {
      // Skip cover-page placeholder fields ("[ACTIVITY TITLE]", "[Quarterly] Progress Report … [XX]")
      // — two or more bracketed fields in one line is a form field, never real guidance text.
      if (/_{3,}/.test(s) || s.length < 12 || (s.match(/\[[^\]]{1,40}\]/g)?.length ?? 0) >= 2) continue;
      const source = { excerpt: s.slice(0, 500), ...(p.page ? { page: p.page } : {}) };
      if (!frequency) for (const [re, f] of FREQUENCIES) if (re.test(s)) frequency = f;
      const sectionOnly = p.kind === "SECTION";
      if (!sectionOnly) {
        const deadline = DEADLINE.exec(s);
        if (deadline && req.submission.deadlineOffsetDays === undefined) {
          req.submission.deadlineOffsetDays = Number(deadline[1]);
          req.submission.deadlineRule = s;
        }
        const pages = MAX_PAGES.exec(s);
        if (pages && p.kind !== "SUBMISSION" && req.formatting.maxPages === undefined) req.formatting.maxPages = Number(pages[1]);
        const font = FONT.exec(s);
        if (font && !req.formatting.font) req.formatting.font = font[2] ? `${font[1]} ${font[2]}pt` : font[1];
        if (p.kind === "SUBMISSION" || (p.kind !== "FORMATTING" && SUBMISSION_SENTENCE.test(s) && /\breport\b/i.test(s))) {
          req.submission.instructions.push(s);
          continue;
        }
        if (p.kind === "FORMATTING" || FORMAT_SENTENCE.test(s)) {
          req.formatting.rules.push(s);
          continue;
        }
      }
      if (COMPLIANCE_TOPIC.test(s) && OBLIGATION.test(s)) {
        req.compliance.push({ text: s, severity: severityOf(s), source });
        continue;
      }
      if (INDICATOR_SENTENCE.test(s)) {
        req.indicatorRequirements.push({ text: s, disaggregation: disaggregation(s), source });
        continue;
      }
      if (p.kind === "GENERAL" || p.kind === "PREFACE") req.generalInstructions.push(s);
    }
  }

  for (const a of input.annexCandidates) {
    const m = ANNEX_ITEM.exec(a.name.trim());
    const name = (m?.[1] ?? a.name).replace(/[.;:]+$/, "").trim();
    if (name.length < 2) continue;
    req.annexes.push({ name: a.name.trim().length <= 200 ? a.name.trim().replace(/[.;]+$/, "") : name, required: !OPTIONAL.test(`${a.name} ${a.description ?? ""}`), ...(a.description ? { description: a.description } : {}) });
  }

  return createTemplateRequirements({
    reportTitle: input.documentTitle,
    reportingFrequency: frequency,
    submission: req.submission,
    formatting: req.formatting,
    annexes: req.annexes,
    indicatorRequirements: req.indicatorRequirements,
    compliance: req.compliance,
    generalInstructions: req.generalInstructions,
  });
}

export { ANNEX_ITEM };
