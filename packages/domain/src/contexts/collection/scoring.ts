import { answerKey, blank, isNotApplicable, resolvePath } from "./answer-values.js";
import { conditionHolds, referencedFields } from "./conditions.js";
import type { Condition } from "./form-model.js";

/**
 * Turning answers into a score (Phase 62.6). The rules are data stored with the form (a kit supplies them), never code per tool:
 * each item names where its answers are (`xray`, `ward_table.bed.condition`, `wards.*.condition`) and what each answer is worth.
 * Honest by construction: an unanswered item is not worth 0 (it is left out and counted as unanswered), "not applicable" leaves the
 * denominator, a band is shown only when enough was answered, and every result says how many items it stands on.
 */
export interface ScoreItem {
  path: string;
  /** Points by answer: `{ good: 2, average: 1, poor: 0 }`, `{ yes: 1, no: 0 }`. An answer not listed is unanswered. */
  points: Readonly<Record<string, number>>;
  label?: string;
}
export interface ScoreSection {
  key: string;
  title: string;
  weight?: number;
  items: ReadonlyArray<ScoreItem>;
  /**
   * The section counts only when this holds (a facility with no laboratory is not marked down for the laboratory checklist). A section that
   * does not count is listed as skipped, adds no items to the totals and takes no weight.
   */
  relevantWhen?: Condition;
}
export type BandTone = "GOOD" | "FAIR" | "POOR";
export interface ScoreBand { min: number; label: string; tone: BandTone }
export interface ScoreRules {
  sections: ReadonlyArray<ScoreSection>;
  /** Highest `min` first or in any order; the highest band the overall percent reaches is the one shown. */
  bands: ReadonlyArray<ScoreBand>;
  /** The share of items that must be answered before a band is shown (default 0.8). */
  minAnsweredShare?: number;
  /** The weights and bands are a starting point, not the ministry's own: the screen says so. */
  illustrative?: boolean;
}

export interface SectionScore {
  key: string;
  title: string;
  /** 0-100, or null when nothing in the section was answered. */
  percent: number | null;
  earned: number;
  possible: number;
  answered: number;
  unanswered: number;
  notApplicable: number;
  /** The section did not apply to this record (its condition was false). */
  skipped?: boolean;
}
export interface ScoreResult {
  overall: number | null;
  sections: SectionScore[];
  band: { label: string; tone: BandTone } | null;
  /** Why no band is shown. */
  bandWithheld?: "NOT_ENOUGH_ANSWERED" | "NOTHING_ANSWERED" | "NO_BANDS";
  answered: number;
  total: number;
  answeredShare: number;
  illustrative: boolean;
  /** The items worth the least, worst first, for the person who has to act. */
  lowest: Array<{ section: string; path: string; label: string; points: number; possible: number }>;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
const maxPoints = (item: ScoreItem): number => Math.max(0, ...Object.values(item.points));

export function scoreRulesProblems(rules: ScoreRules, keys: ReadonlySet<string>): string[] {
  const out: string[] = [];
  if (rules.sections.length === 0) out.push("The score needs at least one section.");
  const sectionKeys = rules.sections.map((s) => s.key);
  if (new Set(sectionKeys).size !== sectionKeys.length) out.push("Two score sections have the same key.");
  for (const s of rules.sections) {
    if (s.weight !== undefined && !(s.weight > 0)) out.push(`Score section "${s.title}": the weight must be above 0.`);
    if (s.items.length === 0) out.push(`Score section "${s.title}" has no items.`);
    if (s.relevantWhen) for (const ref of referencedFields(s.relevantWhen)) if (!keys.has(ref)) out.push(`Score section "${s.title}": the condition names "${ref}", which is not a field of the form.`);
    for (const item of s.items) {
      if (!keys.has(item.path.split(".")[0]!)) out.push(`Score item "${item.path}" names a field that is not in the form.`);
      if (Object.keys(item.points).length < 2) out.push(`Score item "${item.path}" needs at least two answers with points.`);
    }
  }
  if (rules.bands.length === 0) out.push("The score needs at least one band.");
  if (rules.minAnsweredShare !== undefined && (rules.minAnsweredShare < 0 || rules.minAnsweredShare > 1)) out.push("The share that must be answered is between 0 and 1.");
  return out;
}

export function computeScore(rules: ScoreRules, answers: Readonly<Record<string, unknown>>): ScoreResult {
  const sections: SectionScore[] = [];
  const lowest: ScoreResult["lowest"] = [];
  let answered = 0;
  let total = 0;
  for (const s of rules.sections) {
    if (s.relevantWhen && !conditionHolds(s.relevantWhen, answers)) {
      sections.push({ key: s.key, title: s.title, percent: null, earned: 0, possible: 0, answered: 0, unanswered: 0, notApplicable: 0, skipped: true });
      continue;
    }
    let earned = 0, possible = 0, ans = 0, un = 0, na = 0;
    for (const item of s.items) {
      const leaves = resolvePath(answers, item.path);
      // An item that names nothing (a repeat with no rows yet) is one unanswered item, so it cannot be skipped to raise a score.
      if (leaves.length === 0) { un++; total++; continue; }
      for (const leaf of leaves) {
        total++;
        if (isNotApplicable(leaf.value)) { na++; continue; }
        const key = blank(leaf.value) ? null : answerKey(leaf.value);
        const points = key === null ? undefined : item.points[key];
        if (points === undefined) { un++; continue; }
        ans++; answered++;
        earned += points;
        possible += maxPoints(item);
        if (points < maxPoints(item)) lowest.push({ section: s.title, path: leaf.path ? `${item.path.split(".*")[0]}.${leaf.path}` : item.path, label: item.label ?? item.path, points, possible: maxPoints(item) });
      }
    }
    sections.push({ key: s.key, title: s.title, percent: possible > 0 ? round1((earned / possible) * 100) : null, earned, possible, answered: ans, unanswered: un, notApplicable: na });
  }
  const weighted = rules.sections.map((s, i) => ({ w: s.weight ?? 1, p: sections[i]!.percent })).filter((x): x is { w: number; p: number } => x.p !== null);
  const overall = weighted.length > 0 ? round1(weighted.reduce((sum, x) => sum + x.w * x.p, 0) / weighted.reduce((sum, x) => sum + x.w, 0)) : null;
  const share = total > 0 ? answered / total : 0;
  const need = rules.minAnsweredShare ?? 0.8;
  let band: ScoreResult["band"] = null;
  let bandWithheld: ScoreResult["bandWithheld"];
  if (overall === null) bandWithheld = "NOTHING_ANSWERED";
  else if (rules.bands.length === 0) bandWithheld = "NO_BANDS";
  else if (share < need) bandWithheld = "NOT_ENOUGH_ANSWERED";
  else {
    const reached = [...rules.bands].sort((a, b) => b.min - a.min).find((b) => overall >= b.min);
    band = reached ? { label: reached.label, tone: reached.tone } : null;
  }
  lowest.sort((a, b) => a.points / (a.possible || 1) - b.points / (b.possible || 1));
  return { overall, sections, band, ...(bandWithheld ? { bandWithheld } : {}), answered, total, answeredShare: round1(share * 100) / 100, illustrative: rules.illustrative === true, lowest: lowest.slice(0, 20) };
}
