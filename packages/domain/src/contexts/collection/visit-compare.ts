import { answerKey, blank, isNotApplicable, resolvePath } from "./answer-values.js";
import { computeScore, type ScoreResult, type ScoreRules } from "./scoring.js";

/**
 * A follow-up visit against the baseline (Phase 62.7). Item by item: better, same or worse, by what each answer is worth under the
 * form's own score rules; an item answered in only one visit, or marked not applicable in one, is "not comparable", never a change.
 * Only items matched by the same path are compared, so a question changed between form versions is not read as progress.
 */
export type ItemChange = "IMPROVED" | "SAME" | "WORSE" | "NOT_COMPARABLE";

export interface ItemComparison {
  section: string;
  path: string;
  label: string;
  before: string | null;
  after: string | null;
  change: ItemChange;
}
export interface SectionComparison { key: string; title: string; before: number | null; after: number | null; delta: number | null }
export interface VisitComparison {
  items: ItemComparison[];
  sections: SectionComparison[];
  overall: { before: number | null; after: number | null; delta: number | null };
  counts: Record<ItemChange, number>;
}

const pointsFor = (points: Readonly<Record<string, number>>, value: unknown): number | undefined => {
  if (blank(value) || isNotApplicable(value)) return undefined;
  const key = answerKey(value);
  return key === null ? undefined : points[key];
};
const delta = (a: number | null, b: number | null): number | null => (a === null || b === null ? null : Math.round((b - a) * 10) / 10);

export function compareVisits(rules: ScoreRules, before: Readonly<Record<string, unknown>>, after: Readonly<Record<string, unknown>>): VisitComparison {
  const items: ItemComparison[] = [];
  for (const s of rules.sections) {
    for (const item of s.items) {
      const earlier = new Map(resolvePath(before, item.path).map((n) => [n.path, n.value]));
      const later = new Map(resolvePath(after, item.path).map((n) => [n.path, n.value]));
      for (const path of new Set([...earlier.keys(), ...later.keys()])) {
        const b = pointsFor(item.points, earlier.get(path));
        const a = pointsFor(item.points, later.get(path));
        const change: ItemChange = a === undefined || b === undefined ? "NOT_COMPARABLE" : a > b ? "IMPROVED" : a < b ? "WORSE" : "SAME";
        items.push({ section: s.title, path: path ? `${item.path.split(".*")[0]}.${path}` : item.path, label: item.label ?? item.path, before: answerKey(earlier.get(path)), after: answerKey(later.get(path)), change });
      }
    }
  }
  const was: ScoreResult = computeScore(rules, before);
  const now: ScoreResult = computeScore(rules, after);
  const counts: Record<ItemChange, number> = { IMPROVED: 0, SAME: 0, WORSE: 0, NOT_COMPARABLE: 0 };
  for (const i of items) counts[i.change] += 1;
  return {
    items,
    sections: now.sections.map((s, i) => ({ key: s.key, title: s.title, before: was.sections[i]?.percent ?? null, after: s.percent, delta: delta(was.sections[i]?.percent ?? null, s.percent) })),
    overall: { before: was.overall, after: now.overall, delta: delta(was.overall, now.overall) },
    counts,
  };
}
