/**
 * Increment 5 — Field report → proposed structured inputs → human confirmation.
 *
 * A CONSERVATIVE deterministic extractor. It proposes structured inputs from a
 * field report's text but never invents a value: it can say "I found this"
 * (FOUND, an indicator code + number), "I think this belongs here" (SUGGESTED),
 * and anything it cannot determine is simply not emitted. Nothing is persisted
 * here — the caller shows the proposals, the user confirms/edits, and only then
 * commits to the existing IndicatorUpdate/ActivityUpdate/storyContext model.
 */

export type ExtractionCertainty = "FOUND" | "SUGGESTED";

export interface ProposedIndicatorValue {
  indicatorCode: string;
  value: string;
  certainty: ExtractionCertainty;
  excerpt: string;
}

export interface ProposedActivity {
  title: string;
  date?: string;
  participants?: string;
  certainty: ExtractionCertainty;
}

export interface ProposedStoryContext {
  /** StoryContext key this belongs under (challenges, achievements, ...). */
  field: "challenges" | "achievements" | "varianceExplanations" | "adaptations" | "lessons";
  text: string;
  certainty: ExtractionCertainty;
}

export interface FieldReportExtraction {
  indicatorAchievements: ProposedIndicatorValue[];
  activities: ProposedActivity[];
  story: ProposedStoryContext[];
}

const CODE_RE = /\b(OUT|O|IND|G|OC)[-\s]?(\d+)\b/i;
const DATE_RE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s.-]?\d{1,2}([,.]?\s?\d{4})?\b|\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b/i;
const NUMBER_RE = /(\d[\d,]*(?:\.\d+)?)/;
const CHALLENGE_RE = /\b(delay|challeng|flood|problem|setback|risk|could not|couldn't|prevent|difficult)/i;
const ACHIEVEMENT_RE = /\b(completed|delivered|achieved|reached|conducted|trained|held|ran|finished)\b/i;
const VARIANCE_RE = /\b(under[- ]?achieved|over[- ]?achieved|below target|above target|shortfall|exceeded target|did not meet)\b/i;
const ADAPTATION_RE = /\b(adapted|changed|adjusted|switched|pivoted|modified|alternative)\b/i;
const LESSON_RE = /\b(lesson|learned|learnt|insight|observed|we found)\b/i;

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Conservative extraction. Only indicator code + number lines are treated as
 * FOUND; activities require a date and/or participant count; story requires an
 * explicit cue. Everything ambiguous is omitted (never guessed).
 */
export function proposeFieldReportExtraction(text: string): FieldReportExtraction {
  const indicatorAchievements: ProposedIndicatorValue[] = [];
  const activities: ProposedActivity[] = [];
  const story: ProposedStoryContext[] = [];
  const seenCodes = new Set<string>();

  // Field reports mix numbers and prose in the same paragraph, so classify
  // sentence by sentence (period/question/newline separated), not line by line.
  const lines = text
    .split(/[.!?]\s+|\n+/)
    .map(clean)
    .filter((l) => l.length >= 3);

  for (const line of lines) {
    const codeMatch = line.match(CODE_RE);
    // The reported value is the FIRST number AFTER the indicator code — never
    // the digit inside the code itself ("OUT-1" must not yield "1").
    const afterCode = codeMatch ? line.slice((codeMatch.index ?? 0) + codeMatch[0].length) : line;
    const numberMatch = afterCode.match(NUMBER_RE);
    if (codeMatch && numberMatch) {
      const code = `${codeMatch[1]}-${codeMatch[2]}`.toUpperCase();
      if (!seenCodes.has(code)) {
        seenCodes.add(code);
        indicatorAchievements.push({
          indicatorCode: code,
          value: numberMatch[1] ?? "",
          certainty: "FOUND",
          excerpt: line.slice(0, 140),
        });
      }
      continue;
    }

    if (DATE_RE.test(line) && line.split(" ").length >= 3) {
      const title = line.replace(DATE_RE, "").replace(NUMBER_RE, "").replace(/[.,:]+$/g, "").trim() || line;
      activities.push({ title: title.slice(0, 160), date: line.match(DATE_RE)?.[0], certainty: "SUGGESTED" });
      continue;
    }

    if (CHALLENGE_RE.test(line) || VARIANCE_RE.test(line)) {
      story.push({ field: VARIANCE_RE.test(line) ? "varianceExplanations" : "challenges", text: line.slice(0, 240), certainty: "SUGGESTED" });
      continue;
    }
    if (ACHIEVEMENT_RE.test(line)) {
      story.push({ field: "achievements", text: line.slice(0, 240), certainty: "SUGGESTED" });
      continue;
    }
    if (ADAPTATION_RE.test(line)) {
      story.push({ field: "adaptations", text: line.slice(0, 240), certainty: "SUGGESTED" });
      continue;
    }
    if (LESSON_RE.test(line)) {
      story.push({ field: "lessons", text: line.slice(0, 240), certainty: "SUGGESTED" });
    }
  }

  return { indicatorAchievements, activities, story };
}
