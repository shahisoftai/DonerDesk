/**
 * Which suggested result a library indicator belongs under (Phase 46). A library indicator names no result by id (a sector's suggested
 * results are one choice among many); this scores how well its wording fits each suggested result of its sector and answers the best
 * one at the right level, or nothing. Used so indicators chosen from the library land under the result they measure instead of the first
 * result at their level. Pure, deterministic, and a plain word-overlap score: it only ever suggests a place, a person can move it.
 */
import type { LibraryIndicator, LibraryLevel, LogframeSkeletonNode } from "./model.js";

const STOP = new Set(["the", "and", "with", "for", "are", "per", "that", "this", "from", "into", "have", "has", "their", "people", "provided", "delivered", "built", "made", "used", "kept"]);

/** Words reduced to their first five letters, so "toilet" and "toilets", "test" and "tested" meet. */
const stems = (text: string): Set<string> => new Set(text.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !STOP.has(w)).map((w) => w.slice(0, 5)));

const NEAR: Readonly<Record<LibraryLevel, readonly LibraryLevel[]>> = { GOAL: ["GOAL"], OUTCOME: ["OUTCOME"], OUTPUT: ["OUTPUT"], ACTIVITY: ["ACTIVITY", "OUTPUT"] };

export function bestSkeletonNode(entry: LibraryIndicator, skeleton: readonly LogframeSkeletonNode[], minScore = 1): LogframeSkeletonNode | null {
  const ownWords = stems(`${entry.name} ${entry.group} ${entry.sourceRef.standard ?? ""}`);
  let best: { node: LogframeSkeletonNode; score: number } | null = null;
  for (const node of skeleton) {
    if (!NEAR[entry.level].includes(node.level)) continue;
    const nodeWords = stems(`${node.title} ${(node.standards ?? []).join(" ")}`);
    let score = 0;
    for (const w of ownWords) if (nodeWords.has(w)) score += 1;
    // A node that names the entry's own standard is the strongest sign there is.
    if (entry.sourceRef.standard && (node.standards ?? []).some((s) => entry.sourceRef.standard!.startsWith(s) || s.startsWith(entry.sourceRef.standard!))) score += 3;
    if (score >= minScore && (!best || score > best.score)) best = { node, score };
  }
  return best?.node ?? null;
}

/** A project's own wording must share at least two words with the indicator: one shared word ("health", "water") fits too many results to be a reason. */
const OWN_WORDING_MIN = 2;
const same = (a: string | null | undefined, b: string | null | undefined): boolean => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/**
 * Where, among a project's (or a draft's) own results, an indicator from the library goes. Two honest signals only: the result carrying the
 * title of the sector's suggested result that fits it best, else the result whose own wording fits it best. When neither fits (an indicator
 * from another sector, or a project whose results were written differently) the answer is nothing: the person chooses, because the first
 * result at the same level is a guess that puts a school toilet indicator under a water supply output.
 */
export function pickNodeFor<T extends { level: string; title: string | null }>(entry: LibraryIndicator, nodes: readonly T[], skeleton: readonly LogframeSkeletonNode[]): T | null {
  const wanted = bestSkeletonNode(entry, skeleton);
  const exact = wanted ? nodes.find((n) => n.level === wanted.level && same(n.title, wanted.title)) : undefined;
  if (exact) return exact;
  const own = bestSkeletonNode(entry, nodes.filter((n) => n.title).map((n, i) => ({ key: String(i), level: n.level as LibraryLevel, title: n.title ?? "" })), OWN_WORDING_MIN);
  return own ? nodes.find((n) => n.level === own.level && same(n.title, own.title)) ?? null : null;
}
