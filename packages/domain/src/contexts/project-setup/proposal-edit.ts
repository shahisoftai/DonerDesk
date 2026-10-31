/**
 * Review edits (Phase 36): the pure operations a person's review screen applies to a proposal — accept an item, reject it,
 * replace its value, or fill one that was "Not stated". Every operation returns a new proposal and never changes the one it
 * was given; a refused change says why in a sentence. An edited or filled value is marked EDITED: it is the person's own
 * words, it no longer needs a quote, and grounding never checks it again. Items are addressed by a path from the proposal
 * root ("facts.name", "logframe.0", "budget.2"); the path's first segment must be a field the area owns, so no screen can
 * reach into another area's items.
 */
import { SETUP_AREAS, type SetupAreaKey } from "./proposal-areas.js";
import type { ProjectSetupProposal, Proposed } from "./proposal.js";

export interface SetupItemRef {
  area: SetupAreaKey;
  /** Path from the proposal root: the area's field, then the item ("logframe.0"). */
  path: string;
}

export type ProposalEditResult = { ok: true; proposal: ProjectSetupProposal } | { ok: false; reason: string };

const isProposedNode = (x: unknown): x is Proposed<unknown> =>
  typeof x === "object" && x !== null && "value" in x && "status" in x && "sourceQuote" in x && "confidence" in x;

/** Walks segments (object keys, array indexes) to the item; undefined when any step misses. */
function resolveNode(root: unknown, segments: readonly string[]): { node: unknown } | undefined {
  let node: unknown = root;
  for (const seg of segments) {
    if (Array.isArray(node)) {
      const index = Number(seg);
      if (!Number.isInteger(index) || index < 0 || index >= node.length) return undefined;
      node = node[index];
    } else if (node && typeof node === "object") {
      const container = node as Record<string, unknown>;
      if (!(seg in container)) return undefined;
      node = container[seg];
    } else {
      return undefined;
    }
  }
  return { node };
}

/** An immutable path copy: containers along the path are copied, everything else is shared. */
function setNode(root: unknown, segments: readonly string[], value: unknown): unknown {
  const [head, ...rest] = segments;
  if (head === undefined) return value;
  if (Array.isArray(root)) {
    const index = Number(head);
    if (!Number.isInteger(index) || index < 0 || index >= root.length) return root;
    const copy = [...root];
    copy[index] = setNode(copy[index], rest, value);
    return copy;
  }
  if (!root || typeof root !== "object") return root;
  const copy = { ...(root as Record<string, unknown>) };
  copy[head] = setNode(copy[head], rest, value);
  return copy;
}

function mutate(
  proposal: ProjectSetupProposal,
  ref: SetupItemRef,
  change: (node: Proposed<unknown>) => Proposed<unknown> | string,
): ProposalEditResult {
  const area = SETUP_AREAS[ref.area];
  if (!area) return { ok: false, reason: "This area is not part of a setup proposal." };
  const segments = ref.path.split(".");
  if (segments.length !== 2 || segments.some((s) => !s) || !area.fields.includes(segments[0]!)) {
    return { ok: false, reason: `This change does not point at an item of the ${area.labelKey} area.` };
  }
  const found = resolveNode(proposal, segments);
  if (!found || !isProposedNode(found.node)) return { ok: false, reason: "This item is not in the proposal." };
  const next = change(found.node);
  if (typeof next === "string") return { ok: false, reason: next };
  return { ok: true, proposal: setNode(proposal, segments, next) as ProjectSetupProposal };
}

/** Marks an item as applied. Accepting twice changes nothing. */
export function acceptItem(proposal: ProjectSetupProposal, ref: SetupItemRef): ProposalEditResult {
  return mutate(proposal, ref, (node) => (node.status === "ACCEPTED" ? node : { ...node, status: "ACCEPTED" }));
}

/** Leaves an item out: it is counted, shown as rejected, and never applied. */
export function rejectItem(proposal: ProjectSetupProposal, ref: SetupItemRef): ProposalEditResult {
  return mutate(proposal, ref, (node) => (node.status === "REJECTED" ? node : { ...node, status: "REJECTED" }));
}

/** Replaces the value with the person's own; the original quote stays for reference, the item becomes EDITED. */
export function editValue(proposal: ProjectSetupProposal, ref: SetupItemRef, value: unknown): ProposalEditResult {
  return mutate(proposal, ref, (node) => {
    if (value === undefined) return "A value is required: clear a value with an edit to null, not by sending nothing.";
    return { ...node, value, status: "EDITED" };
  });
}

/** Fills a value the document did not state; refused when a value is already there (edit that one instead). */
export function fillNotStated(proposal: ProjectSetupProposal, ref: SetupItemRef, value: unknown): ProposalEditResult {
  return mutate(proposal, ref, (node) => {
    if (node.value !== null) return "This item already has a value; edit it instead of filling it.";
    if (value === undefined || value === null) return "Filling a \"Not stated\" item needs a value.";
    return { ...node, value, status: "EDITED" };
  });
}
