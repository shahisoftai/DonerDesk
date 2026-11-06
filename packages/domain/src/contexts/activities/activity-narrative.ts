/**
 * Someone describes an activity in their own words (typed or dictated); this proposes the form fields that the text
 * states outright. Conservative by design, like the field-report extractor: a value is proposed only when the words
 * say it (a date, a place after "in", a count next to "women"/"men"/"children"/"participants", a labelled section),
 * never inferred or invented, and the person confirms it in the form. Pure: no I/O, the clock is passed in.
 */

export interface ProposedActivityFields {
  activityTitle?: string;
  /** ISO calendar date, YYYY-MM-DD. */
  activityDate?: string;
  /** ISO date the activity ran through, when the words give a span ("from 2 to 4 November"). */
  activityEndDate?: string;
  location?: string;
  participantsTotal?: number;
  participantsMale?: number;
  participantsFemale?: number;
  participantsChildren?: number;
  participantsDisability?: number;
  summary?: string;
  achievements?: string;
  challenges?: string;
  lessonsLearned?: string;
  nextSteps?: string;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_PATTERN = `(${MONTHS.map((m) => m.slice(0, 3)).join("|")})[a-z]*\\.?`;
const monthIndex = (word: string): number => MONTHS.findIndex((m) => m.startsWith(word.slice(0, 3).toLowerCase()));

const iso = (y: number, m: number, d: number): string | undefined => {
  const date = new Date(Date.UTC(y, m, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m && date.getUTCDate() === d ? date.toISOString().slice(0, 10) : undefined;
};

/** "2 to 4 November", "from 9-13 Nov 2026": the first and last day of a span inside one month. */
export function findActivityRange(text: string, today: Date): { start: string; end: string } | undefined {
  const m = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|-|–|until|through|and)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_PATTERN}(?:,?\\s+(\\d{4}))?`, "i"));
  if (!m) return undefined;
  const year = Number(m[4] ?? today.getUTCFullYear());
  const start = iso(year, monthIndex(m[3]!), Number(m[1]));
  const end = iso(year, monthIndex(m[3]!), Number(m[2]));
  return start && end && start < end ? { start, end } : undefined;
}

export function findActivityDate(text: string, today: Date): string | undefined {
  const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return iso(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  const dayFirst = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_PATTERN}(?:,?\\s+(\\d{4}))?`, "i"));
  if (dayFirst) return iso(Number(dayFirst[3] ?? today.getUTCFullYear()), monthIndex(dayFirst[2]!), Number(dayFirst[1]));
  const monthFirst = text.match(new RegExp(`\\b${MONTH_PATTERN}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "i"));
  if (monthFirst) return iso(Number(monthFirst[3] ?? today.getUTCFullYear()), monthIndex(monthFirst[1]!), Number(monthFirst[2]));
  const day = (offset: number) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset));
    return d.toISOString().slice(0, 10);
  };
  if (/\byesterday\b/i.test(text)) return day(-1);
  if (/\btoday\b/i.test(text)) return day(0);
  return undefined;
}

const count = (raw: string): number => Number(raw.replace(/,/g, ""));

/** The first number written right before one of the words, e.g. "40 women", "1,200 participants". */
function countBefore(text: string, words: string): number | undefined {
  const match = text.match(new RegExp(`\\b(\\d[\\d,]*)\\s+(?:(?:registered|young|adult|local|new|more|additional)\\s+)?(?:${words})\\b(?!\\s+(?:living\\s+)?with\\s+(?:a\\s+)?disabilit)`, "i"));
  return match ? count(match[1]!) : undefined;
}

export function findParticipantCounts(text: string): Pick<ProposedActivityFields, "participantsTotal" | "participantsMale" | "participantsFemale" | "participantsChildren" | "participantsDisability"> {
  const out: ReturnType<typeof findParticipantCounts> = {};
  const total = countBefore(text, "participants|attendees|beneficiaries|people|persons|community members|households");
  const female = countBefore(text, "women|females?");
  const male = countBefore(text, "men|males?");
  const children = countBefore(text, "children|kids|under[- ]?18s?");
  const disability = text.match(/\b(\d[\d,]*)\s+(?:people|persons|participants|women|men|children)?\s*(?:with\s+(?:a\s+)?disabilit(?:y|ies)|living with disabilit(?:y|ies))/i);
  if (total !== undefined) out.participantsTotal = total;
  if (male !== undefined) out.participantsMale = male;
  if (female !== undefined) out.participantsFemale = female;
  if (children !== undefined) out.participantsChildren = children;
  if (disability) out.participantsDisability = count(disability[1]!);
  return out;
}

const NOT_A_PLACE = new RegExp(`^(${MONTHS.join("|")}|the|a|an|total|order|addition|total|particular|general|line|total)$`, "i");

export function findLocation(text: string): string | undefined {
  const re = /(?<![.!?]\s)(?<!^)\b(?:in|at|near)\s+((?:[A-Z][\w'’-]*)(?:\s+(?:[A-Z][\w'’-]*|of|el|al|de)){0,3})/g;
  for (const match of text.matchAll(re)) {
    const place = match[1]!.trim().replace(/\s+(of|el|al|de)$/i, "");
    if (!NOT_A_PLACE.test(place.split(/\s+/)[0]!)) return place;
  }
  return undefined;
}

type SectionKey = "summary" | "achievements" | "challenges" | "lessonsLearned" | "nextSteps";
const SECTION_LABELS: ReadonlyArray<[SectionKey, RegExp]> = [
  ["summary", /summary/],
  ["achievements", /achievements?|results/],
  ["challenges", /challenges?|problems|difficulties/],
  ["lessonsLearned", /lessons?(?: learned| learnt)?/],
  ["nextSteps", /next steps?|follow[- ]?up/],
];

/** A label only opens a section at the start of the text or of a sentence or line, so "next steps" inside prose is not one. */
const LABEL_RE = new RegExp(`(?:^|[.!?\\n]\\s*)(${SECTION_LABELS.map(([, r]) => r.source).join("|")})\\s*[:,\\-–]?\\s+`, "gi");

function splitSections(text: string): { lead: string; sections: Partial<Record<SectionKey, string>> } {
  const marks: Array<{ key: SectionKey; start: number; bodyStart: number }> = [];
  for (const m of text.matchAll(LABEL_RE)) {
    const label = m[1]!.toLowerCase();
    const key = SECTION_LABELS.find(([, r]) => new RegExp(`^(?:${r.source})$`, "i").test(label))?.[0];
    if (!key) continue;
    // The sentence end that precedes the label belongs to the previous section.
    const labelOffset = m[0].toLowerCase().indexOf(label);
    marks.push({ key, start: m.index! + labelOffset, bodyStart: m.index! + m[0].length });
  }
  if (marks.length === 0) return { lead: text.trim(), sections: {} };
  const sections: Partial<Record<SectionKey, string>> = {};
  marks.forEach((mark, i) => {
    const end = marks[i + 1]?.start ?? text.length;
    const body = text.slice(mark.bodyStart, end).trim();
    if (body) sections[mark.key] = sections[mark.key] ? `${sections[mark.key]} ${body}` : body;
  });
  return { lead: text.slice(0, marks[0]!.start).trim(), sections };
}

const MAX_TITLE = 120;

function titleFrom(text: string): string | undefined {
  const first = text.split(/(?<=[.!?])\s+|\n/)[0]?.trim().replace(/[.!?]+$/, "");
  if (!first) return undefined;
  return first.length <= MAX_TITLE ? first : `${first.slice(0, MAX_TITLE - 1).trimEnd()}…`;
}

export function proposeActivityFromNarrative(narrative: string, options: { today: Date }): ProposedActivityFields {
  const text = narrative.replace(/\r/g, "").trim();
  if (!text) return {};
  const { lead, sections } = splitSections(text);
  const out: ProposedActivityFields = {};
  const title = titleFrom(lead || sections.summary || text);
  if (title) out.activityTitle = title;
  const range = findActivityRange(text, options.today);
  const date = range?.start ?? findActivityDate(text, options.today);
  if (date) out.activityDate = date;
  if (range) out.activityEndDate = range.end;
  const location = findLocation(text);
  if (location) out.location = location;
  Object.assign(out, findParticipantCounts(text));
  const summary = sections.summary ?? (lead || undefined);
  if (summary) out.summary = summary;
  for (const key of ["achievements", "challenges", "lessonsLearned", "nextSteps"] as const) {
    if (sections[key]) out[key] = sections[key];
  }
  return out;
}
