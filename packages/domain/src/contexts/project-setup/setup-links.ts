/**
 * Placing items under their results (Phase 37.5): an indicator, a planned activity or a budget line the documents did not tie
 * to a logframe code is tied by its wording — the result whose title shares the most words with it — but only when one
 * result clearly wins. A weak or tied match leaves the link empty ("Choose a result"), never a guess. A link made here is
 * marked `linkSource: "SUGGESTED"` so the review never shows it as the document's own, and a link a person set (EDITED) or
 * the document stated is never changed. Runs after `proposeCodes` at apply (so generated codes can be linked to) and at the
 * end of reading (results that already have a code). Pure.
 */
import { willApplyItem } from "./project-codes.js";
import type { BudgetLineDef, IndicatorDef, LinkSource, LogframeNodeDef, PlannedActivityDef, ProjectSetupProposal, Proposed, SetupLogLevel } from "./proposal.js";

/** The least share of words a link needs, and how far ahead of the runner-up it must be. */
export const LINK_THRESHOLD = 0.34;
export const LINK_MARGIN = 0.08;

const STOP_WORDS = new Set([
  "a", "an", "and", "the", "of", "to", "in", "on", "for", "with", "by", "at", "from", "as", "or", "is", "are", "be", "will", "its", "their",
  "per", "all", "into", "through", "including", "under", "within", "among", "between", "other", "etc", "number", "percentage", "proportion",
  "le", "la", "les", "des", "du", "de", "et", "en", "pour", "el", "los", "las", "y", "del", "por", "para", "con",
]);

const stem = (word: string): string => word.replace(/(ings|ing|ies|ied|es|ed|s)$/, (m) => (m === "ies" || m === "ied" ? "y" : "")).replace(/(?<=..)e$/, "");

/** The content words of a text, lightly stemmed ("trainings" = "training" = "train"). */
export function contentWords(text: string | null | undefined): Set<string> {
  const words = (text ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
  return new Set(words.map(stem));
}

/** Dice similarity of two word sets: 1 = the same words, 0 = none shared. */
export function wordOverlap(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return (2 * shared) / (a.size + b.size);
}

interface Candidate {
  code: string;
  level: SetupLogLevel;
  words: Set<string>;
}

const candidatesOf = (proposal: ProjectSetupProposal): Candidate[] =>
  proposal.logframe
    .filter((n) => n.status !== "REJECTED" && n.value?.code)
    .map((n) => {
      const node = n.value as LogframeNodeDef;
      return { code: node.code!, level: node.level, words: contentWords(`${node.title ?? ""} ${node.description ?? ""}`) };
    });

export interface LinkChoice {
  code: string;
  score: number;
}

/**
 * The best result for a text among the given levels, tried in order (an activity before an output): the first level with a
 * clear winner answers. `extra` is a weaker second text (the work-plan heading a row sits under), worth 80 % of a match.
 */
export function bestLink(text: string, extra: string | null | undefined, candidates: ReadonlyArray<Candidate>, levels: ReadonlyArray<SetupLogLevel>, threshold = LINK_THRESHOLD): LinkChoice | null {
  const own = contentWords(text);
  const group = contentWords(extra);
  for (const level of levels) {
    const scored = candidates
      .filter((c) => c.level === level)
      .map((c) => ({ code: c.code, score: Math.max(wordOverlap(own, c.words), 0.8 * wordOverlap(group, c.words)) }))
      .sort((x, y) => y.score - x.score);
    const [first, second] = scored;
    if (first && first.score >= threshold && (!second || first.score - second.score >= LINK_MARGIN)) return first;
  }
  return null;
}

type Linked = { logframeCode: string | null; linkSource?: LinkSource };

const linkable = (item: Proposed<Linked>): boolean =>
  item.value !== null && !item.value.logframeCode && item.value.linkSource !== "PERSON" && item.status !== "EDITED" && item.status !== "REJECTED";

function linkList<T extends Linked>(
  items: ReadonlyArray<Proposed<T>>,
  choose: (value: T) => LinkChoice | null,
  codes: ReadonlySet<string>,
): Proposed<T>[] {
  return items.map((original) => {
    // A suggestion whose result is gone (the results were read again) is withdrawn first, then made again if one fits.
    const stale = original.value?.linkSource === "SUGGESTED" && original.value.logframeCode !== null && !codes.has(original.value.logframeCode);
    const item: Proposed<T> = stale ? { ...original, value: { ...(original.value as T), logframeCode: null, linkSource: undefined } } : original;
    if (stale) delete (item.value as Linked).linkSource;
    if (!linkable(item as Proposed<Linked>)) return item;
    const choice = choose(item.value as T);
    return choice ? { ...item, value: { ...(item.value as T), logframeCode: choice.code, linkSource: "SUGGESTED" as const } } : (item as Proposed<T>);
  });
}

/** Ties every unlinked indicator, planned activity and budget line to its result where the wording clearly says which. */
export function linkProposal(proposal: ProjectSetupProposal): ProjectSetupProposal {
  const candidates = candidatesOf(proposal);
  const codes = new Set(candidates.map((c) => c.code));
  return {
    ...proposal,
    indicators: linkList<IndicatorDef>(proposal.indicators, (i) => bestLink(`${i.title ?? ""} ${i.meansOfVerification ?? ""}`, null, candidates, ["OUTPUT", "OUTCOME", "GOAL"]), codes),
    plan: linkList<PlannedActivityDef>(proposal.plan, (a) => bestLink(a.title ?? "", a.group, candidates, ["ACTIVITY", "OUTPUT"]), codes),
    // A budget line names a cost category far more often than a result: it needs a much closer match.
    budget: linkList<BudgetLineDef>(proposal.budget, (b) => bestLink(b.category ?? "", null, candidates, ["ACTIVITY", "OUTPUT"], 0.6), codes),
  };
}

export interface LinkSummary {
  /** Items that will be written and have a result. */
  linked: number;
  /** Items that will be written with no result; the review asks a person to choose one. */
  unlinked: number;
}

/** How many of an area's chosen items are placed under a result. */
export function linkSummary(items: ReadonlyArray<Proposed<{ logframeCode: string | null }>>): LinkSummary {
  const chosen = items.filter(willApplyItem);
  const linked = chosen.filter((i) => i.value!.logframeCode).length;
  return { linked, unlinked: chosen.length - linked };
}
