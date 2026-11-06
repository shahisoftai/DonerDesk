/**
 * The review's structural edits (Phase 37.6), pure like the rest of `proposal-edit.ts`:
 *  - `chooseAlternative`: take another reading of a fact (the one shown goes into the alternatives);
 *  - `moveResult`: change a result's level or parent; the chain is put back in tree order so codes and nesting follow;
 *  - `addIndicator`: an indicator the documents do not have, typed by a person under a result (it is EDITED: their own).
 * Every refusal is a sentence.
 */
import { mutateItem, type ProposalEditResult, type SetupItemRef } from "./proposal-edit.js";
import { SETUP_AREAS, type SetupAreaKey } from "./proposal-areas.js";
import { LEVEL_RANK, orderAsTree } from "./results-chain.js";
import type { Alternative, IndicatorDef, LogframeNodeDef, ProjectSetupProposal, Proposed, SetupLogLevel } from "./proposal.js";

export function chooseAlternative(proposal: ProjectSetupProposal, ref: SetupItemRef, index: unknown): ProposalEditResult {
  return mutateItem(proposal, ref, (node) => {
    const list = (node.alternatives ?? []) as Alternative<unknown>[];
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= list.length) return "Choose one of the other readings shown.";
    const chosen = list[index]!;
    const rest = list.filter((_, i) => i !== index);
    const current = node.value !== null && node.sourceQuote ? [{ value: node.value, sourceQuote: node.sourceQuote, sourceRef: node.sourceRef }] : [];
    const alternatives = [...current, ...rest];
    const { alternatives: _old, ...bare } = node;
    return { ...bare, value: chosen.value, sourceQuote: chosen.sourceQuote, sourceRef: chosen.sourceRef, status: "ACCEPTED", ...(alternatives.length > 0 ? { alternatives } : {}) };
  });
}

const LEVELS: readonly SetupLogLevel[] = ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"];

export interface ResultMove {
  level: SetupLogLevel;
  /** The code of the result it now sits under, or null for the top. */
  parentCode: string | null;
}

function readMove(raw: unknown): ResultMove | string {
  if (!raw || typeof raw !== "object") return "Say where the result goes.";
  const { level, parentCode } = raw as Record<string, unknown>;
  if (typeof level !== "string" || !LEVELS.includes(level as SetupLogLevel)) return "Choose a level.";
  if (parentCode !== null && typeof parentCode !== "string") return "Choose the result it sits under, or none.";
  return { level: level as SetupLogLevel, parentCode: parentCode as string | null };
}

export function moveResult(proposal: ProjectSetupProposal, ref: SetupItemRef, raw: unknown): ProposalEditResult {
  const move = readMove(raw);
  if (typeof move === "string") return { ok: false, reason: move };
  const [field, at] = ref.path.split(".");
  const index = Number(at);
  if (field !== "logframe" || !Number.isInteger(index) || !proposal.logframe[index]?.value) return { ok: false, reason: "Only a result can be moved." };
  const items = proposal.logframe;
  const self = items[index]!.value!;
  const byCode = new Map<string, number>();
  items.forEach((n, i) => { if (n.status !== "REJECTED" && n.value?.code && !byCode.has(n.value.code)) byCode.set(n.value.code, i); });
  if (move.parentCode !== null) {
    const p = byCode.get(move.parentCode);
    if (p === undefined) return { ok: false, reason: "That result is not among the proposed results." };
    if (p === index) return { ok: false, reason: "A result cannot sit under itself." };
    if (LEVEL_RANK[items[p]!.value!.level] >= LEVEL_RANK[move.level]) return { ok: false, reason: "A result sits under a result one level or more above it." };
    // Walking up from the new parent must never reach the result being moved.
    for (let cursor: number | undefined = p, guard = 0; cursor !== undefined && guard < items.length; guard += 1) {
      const up: string | null | undefined = items[cursor]!.value?.parentCode;
      cursor = up ? byCode.get(up) : undefined;
      if (cursor === index) return { ok: false, reason: "A result cannot sit under one of its own parts." };
    }
  } else if (move.level !== "GOAL") {
    return { ok: false, reason: "Only a goal sits at the top: choose the result this one belongs to." };
  }
  const moved: LogframeNodeDef = { ...self, level: move.level, parentCode: move.parentCode };
  const next = items.map((n, i) => (i === index ? { ...n, value: moved } : n));
  const { items: ordered } = orderAsTree(next, (i) => {
    const code = next[i]!.value?.parentCode;
    return code ? byCode.get(code) ?? null : null;
  });
  return { ok: true, proposal: { ...proposal, logframe: ordered } };
}

const INDICATOR_TYPES = ["NUMBER", "PERCENTAGE", "RATIO", "CURRENCY"] as const;

const short = (x: unknown, max: number): string | null => (typeof x === "string" && x.trim() ? x.trim().slice(0, max) : null);

/** Adds the indicator in `raw`; only an area that owns the indicators field (the registry says which) may add one. */
export function addIndicator(proposal: ProjectSetupProposal, raw: unknown, area?: SetupAreaKey): ProposalEditResult {
  if (area !== undefined && !SETUP_AREAS[area].fields.includes("indicators")) return { ok: false, reason: "Indicators are added in the indicators step." };
  if (!raw || typeof raw !== "object") return { ok: false, reason: "Describe the indicator." };
  const v = raw as Record<string, unknown>;
  const title = short(v.title, 300);
  if (!title) return { ok: false, reason: "Give the indicator a name." };
  const logframeCode = short(v.logframeCode, 40);
  if (logframeCode && !proposal.logframe.some((n) => n.status !== "REJECTED" && n.value?.code === logframeCode)) {
    return { ok: false, reason: "That result is not among the proposed results." };
  }
  const code = short(v.code, 40);
  if (code && [...proposal.logframe, ...proposal.indicators].some((n) => n.status !== "REJECTED" && n.value?.code === code)) {
    return { ok: false, reason: `The code ${code} is already used.` };
  }
  const type = typeof v.type === "string" && (INDICATOR_TYPES as readonly string[]).includes(v.type) ? v.type : null;
  const value: IndicatorDef = {
    code, title, logframeCode, type, unit: short(v.unit, 60), baseline: short(v.baseline, 100), target: short(v.target, 100),
    targetSchedule: null, frequency: short(v.frequency, 120), direction: null, disaggregation: null, meansOfVerification: short(v.meansOfVerification, 300),
    ...(code ? { codeSource: "DOCUMENT" as const } : {}), ...(logframeCode ? { linkSource: "PERSON" as const } : {}),
  };
  const item: Proposed<IndicatorDef> = { value, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" };
  return { ok: true, proposal: { ...proposal, indicators: [...proposal.indicators, item] } };
}
