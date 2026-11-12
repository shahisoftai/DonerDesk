/**
 * Choosing from the sector library on the Results and Indicators slides (Phase 46.3): the pure edits. An entry the person picks
 * becomes an indicator in the proposal that is theirs (EDITED, no quote) and remembers its library entry, so launching can link
 * the real indicator to it. The library never sets a baseline or a target; it names a reference standard only as text beside the
 * target. A node of a sector's suggested results is added the same way. Nothing is added twice. Pure.
 */
import { BUILT_IN_CONTENT, DIRECTION_WORDS, KIND_RULES, describeStandard, linkOf, pickNodeFor, projectCodeFor, SECTOR_REGISTRY } from "../../sector-library/index.js";
import type { LibraryIndicator, LibraryLevel, LibrarySectorId, LogframeSkeletonNode } from "../../sector-library/index.js";
import { proposeCodes } from "../project-codes.js";
import type { IndicatorDef, LogframeNodeDef, ProjectSetupProposal, Proposed } from "../proposal.js";

export type LibraryEditResult = { ok: true; proposal: ProjectSetupProposal; added: number; skipped: string[] } | { ok: false; reason: string };

const person = <T>(value: T): Proposed<T> => ({ value, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" });
const live = <T>(items: ReadonlyArray<Proposed<T>>): Array<Proposed<T>> => items.filter((i) => i.status !== "REJECTED" && i.value !== null);

const WIZARD_TYPES = new Set(["NUMBER", "PERCENTAGE", "RATIO", "CURRENCY"]);
const DIMENSION_WORDS: Readonly<Record<string, string>> = { SEX: "Sex", AGE_GROUP: "Age group", DISABILITY: "Disability", LOCATION: "Location", OTHER: "Other" };

export function addFromLibrary(p: ProjectSetupProposal, entries: readonly LibraryIndicator[], logframeCode: string | null | undefined, today: string): LibraryEditResult {
  if (entries.length === 0) return { ok: false, reason: "Choose at least one indicator." };
  const nodes = live(p.logframe).map((n) => n.value!);
  if (logframeCode && !nodes.some((n) => n.code === logframeCode)) return { ok: false, reason: "That result is not among the project's results." };
  const have = new Set(live(p.indicators).flatMap((i) => (i.value!.libraryId ? [i.value!.libraryId] : [])));
  const taken = new Set([...nodes, ...live(p.indicators).map((i) => i.value!)].flatMap((n) => (n.code ? [n.code] : [])));
  const added: Array<Proposed<IndicatorDef>> = [];
  const skipped: string[] = [];
  for (const e of entries) {
    if (have.has(e.id)) { skipped.push(`${e.name}: already in the project.`); continue; }
    const type = KIND_RULES[e.kind].indicatorType;
    if (!WIZARD_TYPES.has(type)) { skipped.push(`${e.name}: add this kind of indicator on the Logframe page once the project exists.`); continue; }
    const target = logframeCode ?? pickNodeFor(e, nodes, BUILT_IN_CONTENT[e.sectorId].logframe)?.code ?? null;
    const code = projectCodeFor(e, taken);
    taken.add(code);
    have.add(e.id);
    const direction = DIRECTION_WORDS[e.direction];
    added.push(person<IndicatorDef>({
      code, title: e.name, logframeCode: target, type, unit: e.unit.slice(0, 60), baseline: null, target: null, targetSchedule: null, frequency: e.frequency.slice(0, 120),
      direction, disaggregation: e.disaggregations.length ? e.disaggregations.map((d) => DIMENSION_WORDS[d] ?? d).slice(0, 10) : null,
      meansOfVerification: e.meansOfVerification.join("; ").slice(0, 300), codeSource: "DOCUMENT", ...(target ? { linkSource: "PERSON" as const } : {}),
      libraryId: e.id, libraryVersion: e.version, libraryLinkJson: JSON.stringify(linkOf(e, today)),
      ...(e.referenceStandard ? { referenceText: describeStandard(e.referenceStandard) } : {}),
    }));
  }
  if (added.length === 0) return { ok: false, reason: skipped[0] ?? "Nothing to add." };
  return { ok: true, proposal: proposeCodes({ ...p, indicators: [...p.indicators, ...added] }, "LIVE"), added: added.length, skipped };
}

const SECTOR_LEVEL_PARENT: Readonly<Record<LibraryLevel, LibraryLevel | null>> = { GOAL: null, OUTCOME: "GOAL", OUTPUT: "OUTCOME", ACTIVITY: "OUTPUT" };

/** Adds a sector's suggested results (and what they hang from). A result already there at the same level with the same title is kept, not doubled; a second goal is never added. */
export function addFromSkeleton(p: ProjectSetupProposal, sectorId: LibrarySectorId, skeleton: readonly LogframeSkeletonNode[], nodeKeys?: readonly string[]): LibraryEditResult {
  if (!SECTOR_REGISTRY[sectorId]) return { ok: false, reason: "That sector is not known." };
  if (skeleton.length === 0) return { ok: false, reason: "This sector has no suggested results." };
  const byKey = new Map(skeleton.map((n) => [n.key, n] as const));
  const wanted = new Set(nodeKeys ?? skeleton.map((n) => n.key));
  for (const k of [...wanted]) for (let up = byKey.get(k)?.parent; up; up = byKey.get(up)?.parent) wanted.add(up);
  let proposal = p;
  const codeByKey = new Map<string, string | null>();
  const skipped: string[] = [];
  let added = 0;
  for (const node of skeleton) {
    if (!wanted.has(node.key)) continue;
    const existing = live(proposal.logframe).find((n) => n.value!.level === node.level && (n.value!.title ?? "").trim().toLowerCase() === node.title.trim().toLowerCase());
    if (existing) { codeByKey.set(node.key, existing.value!.code); continue; }
    if (node.level === "GOAL" && live(proposal.logframe).some((n) => n.value!.level === "GOAL")) { codeByKey.set(node.key, live(proposal.logframe).find((n) => n.value!.level === "GOAL")!.value!.code); skipped.push("The project already has a goal."); continue; }
    const parentLevel = SECTOR_LEVEL_PARENT[node.level];
    const parentCode = node.parent ? codeByKey.get(node.parent) ?? null : null;
    if (parentLevel !== null && node.parent && !parentCode) { skipped.push(`${node.title}: its parent could not be added.`); continue; }
    const def: LogframeNodeDef = { level: node.level, code: null, title: node.title, description: null, parentCode, ...(node.assumption ? { assumptions: node.assumption } : {}) };
    proposal = proposeCodes({ ...proposal, logframe: [...proposal.logframe, person(def)] }, "LIVE");
    codeByKey.set(node.key, live(proposal.logframe).slice(-1)[0]!.value!.code);
    added += 1;
  }
  return added === 0 ? { ok: false, reason: skipped[0] ?? "Those results are already in the project." } : { ok: true, proposal, added, skipped };
}
