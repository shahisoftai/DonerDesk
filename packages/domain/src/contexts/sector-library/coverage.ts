/**
 * What the library covers (Phase 46.8): for each sector, whether each of the eleven pack parts has content or a stated reason for
 * none, how many indicators sit at each result level and in each kind, and every problem the checks find. It is the definition of
 * "comprehensive": a gap with no stated reason is reported, and the content test fails on it.
 */
import { entryProblems } from "./validate-entry.js";
import { packOf } from "./pack-parts.js";
import { bestSkeletonNode } from "./node-match.js";
import { SECTOR_REGISTRY } from "./sectors.js";
import type { LibraryIndicator, LibraryLevel, LibrarySectorId, PackPartKey, SectorContent } from "./model.js";
import { LIBRARY_SECTOR_IDS, PACK_PART_KEYS } from "./model.js";

export interface SectorCoverage {
  sectorId: LibrarySectorId;
  indicators: number;
  byLevel: Record<LibraryLevel, number>;
  /** Parts with content, and parts empty with the reason given. */
  parts: Record<PackPartKey, { items: number; because?: string }>;
  problems: string[];
}

const MIN_INDICATORS = 4;

export function sectorCoverage(c: SectorContent): SectorCoverage {
  const problems: string[] = [];
  const byLevel: Record<LibraryLevel, number> = { GOAL: 0, OUTCOME: 0, OUTPUT: 0, ACTIVITY: 0 };
  for (const e of c.indicators) {
    byLevel[e.level] += 1;
    for (const p of entryProblems(e)) problems.push(`${e.id}: ${p.message}`);
    if (e.sectorId !== c.sectorId) problems.push(`${e.id}: listed under ${c.sectorId} but belongs to ${e.sectorId}.`);
  }
  if (c.indicators.length < MIN_INDICATORS) problems.push(`Only ${c.indicators.length} indicators; at least ${MIN_INDICATORS} are expected.`);
  if (byLevel.OUTPUT + byLevel.OUTCOME === 0) problems.push("No output or outcome indicator.");
  const keys = new Set(c.logframe.map((n) => n.key));
  for (const n of c.logframe) if (n.parent && !keys.has(n.parent)) problems.push(`Logframe node ${n.key} names a parent (${n.parent}) that does not exist.`);
  // The wizard will not start a project whose outcome has no output or whose output has no activity, so the suggested results must be whole.
  const childOf = (key: string, level: string) => c.logframe.some((n) => n.parent === key && n.level === level);
  for (const n of c.logframe) {
    if (n.level === "OUTCOME" && !childOf(n.key, "OUTPUT")) problems.push(`The outcome "${n.title}" has no output under it.`);
    if (n.level === "OUTPUT" && !childOf(n.key, "ACTIVITY")) problems.push(`The output "${n.title}" has no activity under it.`);
  }
  // Every suggested output should be measurable from the library: at least one indicator fits it.
  for (const out of c.logframe.filter((n) => n.level === "OUTPUT")) {
    if (!c.indicators.some((e) => bestSkeletonNode(e, c.logframe)?.key === out.key)) problems.push(`No library indicator fits the output "${out.title}".`);
  }
  const parts = Object.fromEntries(packOf(c).map((p) => [p.key, { items: p.items.length, ...(p.because ? { because: p.because } : {}) }])) as SectorCoverage["parts"];
  for (const k of PACK_PART_KEYS) {
    const p = parts[k];
    if (p.items === 0 && !p.because) problems.push(`The ${k} part is empty with no reason.`);
  }
  return { sectorId: c.sectorId, indicators: c.indicators.length, byLevel, parts, problems };
}

export function libraryCoverage(contents: Readonly<Record<LibrarySectorId, SectorContent>>): { sectors: SectorCoverage[]; problems: string[] } {
  const sectors = LIBRARY_SECTOR_IDS.map((id) => sectorCoverage(contents[id]));
  const problems = sectors.flatMap((s) => s.problems.map((p) => `${s.sectorId}: ${p}`));
  const ids = new Map<string, string>();
  for (const id of LIBRARY_SECTOR_IDS) {
    if (!SECTOR_REGISTRY[id]) problems.push(`${id} has no registry row.`);
    for (const e of contents[id].indicators as readonly LibraryIndicator[]) {
      const other = ids.get(e.id);
      if (other) problems.push(`${e.id} is used in ${other} and ${id}.`);
      ids.set(e.id, id);
    }
  }
  return { sectors, problems };
}
