/**
 * Codes for a document that has none (Phase 36.3, plan R2). Before apply, every logframe node and indicator that will be
 * written gets a code if it lacks one, marked `codeSource: "GENERATED"` so the review screen never shows it as the
 * document's own; a node without a parent is placed under the nearest earlier node one level up. Codes the document gave
 * are never changed, and a generated code never repeats an existing one. Pure; returns a new proposal.
 */
import type { IndicatorDef, LogframeNodeDef, ProjectSetupProposal, Proposed, SetupLogLevel } from "./proposal.js";

const RANK: Record<SetupLogLevel, number> = { GOAL: 0, OUTCOME: 1, OUTPUT: 2, ACTIVITY: 3 };
const PREFIX: Record<SetupLogLevel, string> = { GOAL: "G", OUTCOME: "OC", OUTPUT: "OP", ACTIVITY: "A" };

export const willApplyItem = (item: Proposed<unknown>): boolean => (item.status === "ACCEPTED" || item.status === "EDITED") && item.value !== null;

function unique(base: string, taken: Set<string>): string {
  let code = base;
  for (let n = 2; taken.has(code.toLowerCase()); n += 1) code = `${base}-${n}`;
  taken.add(code.toLowerCase());
  return code;
}

export function proposeCodes(proposal: ProjectSetupProposal): ProjectSetupProposal {
  const taken = new Set<string>();
  for (const item of [...proposal.logframe, ...proposal.indicators]) {
    const code = item.value?.code;
    if (code) taken.add(code.toLowerCase());
  }
  const counters: Record<string, number> = {};
  const next = (key: string): number => (counters[key] = (counters[key] ?? 0) + 1);
  // The last node seen at each rank, for parents and for nested numbering.
  const lastAt: Array<LogframeNodeDef | undefined> = [];

  const logframe = proposal.logframe.map((item) => {
    if (!willApplyItem(item)) return item;
    const node = item.value!;
    const rank = RANK[node.level];
    const parent = rank > 0 ? lastAt.slice(0, rank).reverse().find((n) => n !== undefined) : undefined;
    let out: LogframeNodeDef = { ...node };
    if (!out.parentCode && parent?.code) out = { ...out, parentCode: parent.code };
    if (!out.code) {
      const scope = out.parentCode ?? "";
      const n = next(`${node.level}:${scope}`);
      const numbering = scope && /\d/.test(scope) ? `${scope.replace(/^[A-Za-z]+[-_ ]?/, "")}.${n}` : String(n);
      out = { ...out, code: unique(`${PREFIX[node.level]}${numbering}`, taken), codeSource: "GENERATED" };
    }
    lastAt[rank] = out;
    lastAt.length = rank + 1;
    return { ...item, value: out };
  });

  const indicators = proposal.indicators.map((item) => {
    if (!willApplyItem(item) || item.value!.code) return item;
    const value: IndicatorDef = { ...item.value!, code: unique(`IND${next("IND")}`, taken), codeSource: "GENERATED" };
    return { ...item, value };
  });

  return { ...proposal, logframe, indicators };
}
