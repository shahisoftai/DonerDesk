/**
 * Edits to the results framework and its indicators (Phase 38.3): the pure operations the Results and Indicators slides make
 * on the proposal itself. They sit beside the document's own items: a node or indicator the person adds or changes is theirs
 * (EDITED, no quote). One operation is one row in `RESULT_OPERATIONS`, typed so a kind without a function does not compile.
 * Codes are made for anything left without one, so every item can be referred to by the owners, plans and forms that follow.
 */
import { proposeCodes } from "../project-codes.js";
import { addIndicator } from "../review-operations.js";
import type { IndicatorDef, LogframeNodeDef, ProjectSetupProposal, Proposed, SetupLogLevel } from "../proposal.js";

export type ResultOperation =
  | { kind: "ADD_NODE"; level: SetupLogLevel; title: string; parentCode?: string | null }
  | { kind: "ADD_INDICATOR"; value: Record<string, unknown> }
  | { kind: "EDIT_INDICATOR"; path: string; patch: Partial<Pick<IndicatorDef, "title" | "type" | "unit" | "baseline" | "target" | "frequency" | "logframeCode" | "disaggregation">> }
  | { kind: "EDIT_NODE_TITLE"; path: string; title: string }
  | { kind: "BULK_INDICATORS"; frequency?: string; disaggregation?: string[]; level?: SetupLogLevel };

export type ResultOperationResult = { ok: true; proposal: ProjectSetupProposal } | { ok: false; reason: string };

/** The level a node of each level hangs from. A goal hangs from nothing; an outcome may stand under the goal or alone. */
const PARENT_LEVEL: Record<SetupLogLevel, SetupLogLevel | null> = { GOAL: null, OUTCOME: "GOAL", OUTPUT: "OUTCOME", ACTIVITY: "OUTPUT" };
const PARENT_REQUIRED: Record<SetupLogLevel, boolean> = { GOAL: false, OUTCOME: false, OUTPUT: true, ACTIVITY: true };
const LEVEL_NAME: Record<SetupLogLevel, string> = { GOAL: "goal", OUTCOME: "outcome", OUTPUT: "output", ACTIVITY: "activity" };

type Handler<K extends ResultOperation["kind"]> = (p: ProjectSetupProposal, op: Extract<ResultOperation, { kind: K }>) => ResultOperationResult;

const done = (proposal: ProjectSetupProposal): ResultOperationResult => ({ ok: true, proposal: proposeCodes(proposal, "LIVE") });
const refuse = (reason: string): ResultOperationResult => ({ ok: false, reason });
const person = <T>(value: T): Proposed<T> => ({ value, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" });
const live = <T>(items: ReadonlyArray<Proposed<T>>): Array<Proposed<T>> => items.filter((i) => i.status !== "REJECTED" && i.value !== null);

function itemAt<T>(items: ReadonlyArray<Proposed<T>>, path: string, field: string): { index: number; item: Proposed<T> } | null {
  const [head, raw] = path.split(".");
  const index = Number(raw);
  if (head !== field || !Number.isInteger(index) || index < 0 || index >= items.length) return null;
  const item = items[index]!;
  return item.status === "REJECTED" || item.value === null ? null : { index, item };
}

const clean = (v: string | null | undefined, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export const RESULT_OPERATIONS: { [K in ResultOperation["kind"]]: Handler<K> } = {
  ADD_NODE: (p, { level, title, parentCode }) => {
    const name = clean(title, 300);
    if (!name) return refuse(`Give the ${LEVEL_NAME[level]} a name.`);
    const parentLevel = PARENT_LEVEL[level];
    let parent: string | null = null;
    if (parentLevel !== null) {
      const code = clean(parentCode, 40);
      if (code) {
        const found = live(p.logframe).find((n) => n.value!.code === code);
        if (!found) return refuse("That parent is not among the project's results.");
        if (found.value!.level !== parentLevel) return refuse(`${LEVEL_NAME[level].replace(/^./, (c) => c.toUpperCase())}s go under ${LEVEL_NAME[parentLevel]}s.`);
        parent = code;
      } else if (PARENT_REQUIRED[level]) {
        return refuse(`Choose the ${LEVEL_NAME[parentLevel]} this ${LEVEL_NAME[level]} belongs to.`);
      }
    }
    if (level === "GOAL" && live(p.logframe).some((n) => n.value!.level === "GOAL")) return refuse("A project has one goal.");
    const node: LogframeNodeDef = { level, code: null, title: name, description: null, parentCode: parent };
    return done({ ...p, logframe: [...p.logframe, person(node)] });
  },
  ADD_INDICATOR: (p, { value }) => {
    const added = addIndicator(p, value);
    return added.ok ? done(added.proposal) : refuse(added.reason);
  },
  EDIT_INDICATOR: (p, { path, patch }) => {
    const at = itemAt(p.indicators, path, "indicators");
    if (!at) return refuse("That indicator is not in the project.");
    const next: IndicatorDef = { ...at.item.value! };
    if (patch.title !== undefined) { const t = clean(patch.title, 300); if (!t) return refuse("An indicator needs a name."); next.title = t; }
    for (const k of ["unit", "baseline", "target", "frequency"] as const) if (patch[k] !== undefined) next[k] = clean(patch[k], 120);
    if (patch.type !== undefined) next.type = patch.type;
    if (patch.disaggregation !== undefined) next.disaggregation = patch.disaggregation === null ? null : patch.disaggregation.map((d) => d.trim()).filter(Boolean);
    if (patch.logframeCode !== undefined) {
      const code = clean(patch.logframeCode, 40);
      if (code && !live(p.logframe).some((n) => n.value!.code === code)) return refuse("That result is not among the project's results.");
      next.logframeCode = code;
      next.linkSource = "PERSON";
    }
    const indicators = p.indicators.map((i, n) => (n === at.index ? { ...i, value: next, status: "EDITED" as const } : i));
    return done({ ...p, indicators });
  },
  EDIT_NODE_TITLE: (p, { path, title }) => {
    const at = itemAt(p.logframe, path, "logframe");
    if (!at) return refuse("That result is not in the project.");
    const name = clean(title, 300);
    if (!name) return refuse("A result needs a name.");
    const logframe = p.logframe.map((n, i) => (i === at.index ? { ...n, value: { ...n.value!, title: name }, status: "EDITED" as const } : n));
    return done({ ...p, logframe });
  },
  // Fill-only, like a pack: an indicator that already has a frequency or a breakdown keeps it.
  BULK_INDICATORS: (p, { frequency, disaggregation, level }) => {
    const freq = clean(frequency, 120);
    const breakdown = disaggregation?.map((d) => d.trim()).filter(Boolean);
    if (!freq && !(breakdown && breakdown.length > 0)) return refuse("Choose a frequency or a breakdown to apply.");
    const levelOf = (code: string | null): SetupLogLevel | null => live(p.logframe).find((n) => n.value!.code === code)?.value!.level ?? null;
    const indicators = p.indicators.map((i) => {
      if (i.status === "REJECTED" || i.value === null) return i;
      if (level && levelOf(i.value.logframeCode) !== level) return i;
      const v = { ...i.value };
      if (freq && !clean(v.frequency, 1)) v.frequency = freq;
      if (breakdown && breakdown.length > 0 && (v.disaggregation === null || v.disaggregation.length === 0)) v.disaggregation = breakdown;
      return v.frequency === i.value.frequency && v.disaggregation === i.value.disaggregation ? i : { ...i, value: v, status: "EDITED" as const };
    });
    return done({ ...p, indicators });
  },
};

export function applyResultOperation(proposal: ProjectSetupProposal, op: ResultOperation): ResultOperationResult {
  const handler = RESULT_OPERATIONS[op.kind] as (p: ProjectSetupProposal, o: ResultOperation) => ResultOperationResult;
  return handler(proposal, op);
}
