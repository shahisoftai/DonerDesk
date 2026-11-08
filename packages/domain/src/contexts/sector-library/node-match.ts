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

export function bestSkeletonNode(entry: LibraryIndicator, skeleton: readonly LogframeSkeletonNode[]): LogframeSkeletonNode | null {
  const ownWords = stems(`${entry.name} ${entry.group} ${entry.sourceRef.standard ?? ""}`);
  let best: { node: LogframeSkeletonNode; score: number } | null = null;
  for (const node of skeleton) {
    if (!NEAR[entry.level].includes(node.level)) continue;
    const nodeWords = stems(`${node.title} ${(node.standards ?? []).join(" ")}`);
    let score = 0;
    for (const w of ownWords) if (nodeWords.has(w)) score += 1;
    // A node that names the entry's own standard is the strongest sign there is.
    if (entry.sourceRef.standard && (node.standards ?? []).some((s) => entry.sourceRef.standard!.startsWith(s) || s.startsWith(entry.sourceRef.standard!))) score += 3;
    if (score > 0 && (!best || score > best.score)) best = { node, score };
  }
  return best?.node ?? null;
}

/** The levels to try, in order, when no suggested result fits: the entry's own level first, then its neighbours. */
const FALLBACK: Readonly<Record<LibraryLevel, readonly LibraryLevel[]>> = { GOAL: ["GOAL", "OUTCOME", "OUTPUT"], OUTCOME: ["OUTCOME", "GOAL", "OUTPUT"], OUTPUT: ["OUTPUT", "OUTCOME", "ACTIVITY"], ACTIVITY: ["ACTIVITY", "OUTPUT", "OUTCOME"] };
const same = (a: string | null | undefined, b: string | null | undefined): boolean => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/**
 * Where, among a project's (or a draft's) own results, an indicator from the library goes: the result with the title of the suggested
 * result that fits it best, else the first result at its own level, else a neighbouring level. Nothing when the project has no results.
 */
export function pickNodeFor<T extends { level: string; title: string | null }>(entry: LibraryIndicator, nodes: readonly T[], skeleton: readonly LogframeSkeletonNode[]): T | null {
  const wanted = bestSkeletonNode(entry, skeleton);
  const exact = wanted ? nodes.find((n) => n.level === wanted.level && same(n.title, wanted.title)) : undefined;
  if (exact) return exact;
  for (const level of FALLBACK[entry.level]) { const n = nodes.find((x) => x.level === level); if (n) return n; }
  return null;
}
