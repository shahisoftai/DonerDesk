/**
 * Edits to the risks and assumptions list (Phase 38.9): the pure operations the Launch slide makes on the proposal. An
 * assumption is a kind of risk ("we are assuming"), so one list holds both. A risk a person adds or changes is theirs
 * (EDITED, no quote); the kind and seriousness are chosen from the real lists, never guessed; the same kind with the same
 * title is one entry. One operation is one row in `RISK_OPERATIONS`.
 */
import { RISK_KINDS, SERIOUSNESS_LEVELS } from "../../risks/project-risk.js";
import type { ProjectSetupProposal, Proposed, RiskDef } from "../proposal.js";

export type RiskOperation =
  | { kind: "ADD_RISK"; riskKind: string; title: string; seriousness?: string | null; mitigation?: string | null }
  | { kind: "EDIT_RISK"; path: string; patch: Partial<Pick<RiskDef, "kind" | "title" | "seriousness" | "mitigation">> };

export type RiskOperationResult = { ok: true; proposal: ProjectSetupProposal } | { ok: false; reason: string };
type Handler<K extends RiskOperation["kind"]> = (p: ProjectSetupProposal, op: Extract<RiskOperation, { kind: K }>) => RiskOperationResult;

const refuse = (reason: string): RiskOperationResult => ({ ok: false, reason });
const clean = (v: string | null | undefined, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const kindOk = (k: string | null | undefined): k is string => typeof k === "string" && (RISK_KINDS as string[]).includes(k);
const levelOk = (s: string | null | undefined): boolean => s === null || s === undefined || (SERIOUSNESS_LEVELS as string[]).includes(s);

const sameEntry = (p: ProjectSetupProposal, kind: string, title: string, skip?: number): boolean =>
  p.risks.some((r, i) => i !== skip && r.status !== "REJECTED" && r.value !== null && r.value.kind === kind && (r.value.title ?? "").trim().toLowerCase() === title.toLowerCase());

export const RISK_OPERATIONS: { [K in RiskOperation["kind"]]: Handler<K> } = {
  ADD_RISK: (p, op) => {
    if (!kindOk(op.riskKind)) return refuse("Choose whether it has happened, might happen, or is something you are assuming.");
    const title = clean(op.title, 200);
    if (!title) return refuse("Say what it is.");
    // A risk with no rating is not raised when the project starts, so the wizard asks for one here rather than lose it.
    if (!op.seriousness || !levelOk(op.seriousness)) return refuse("Choose how serious it is: high, medium or low.");
    if (sameEntry(p, op.riskKind, title)) return refuse("That is already on the list.");
    const value: RiskDef = { kind: op.riskKind, title, seriousness: clean(op.seriousness, 10), mitigation: clean(op.mitigation, 1000) };
    const item: Proposed<RiskDef> = { value, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" };
    return { ok: true, proposal: { ...p, risks: [...p.risks, item] } };
  },
  EDIT_RISK: (p, { path, patch }) => {
    const [head, raw] = path.split(".");
    const index = Number(raw);
    const item = head === "risks" && Number.isInteger(index) ? p.risks[index] : undefined;
    if (!item || item.status === "REJECTED" || item.value === null) return refuse("That entry is not on the list.");
    const next: RiskDef = { ...item.value };
    if (patch.kind !== undefined) { if (!kindOk(patch.kind)) return refuse("Choose whether it has happened, might happen, or is something you are assuming."); next.kind = patch.kind; }
    if (patch.title !== undefined) { const t = clean(patch.title, 200); if (!t) return refuse("Say what it is."); next.title = t; }
    if (patch.seriousness !== undefined) { if (!patch.seriousness || !levelOk(patch.seriousness)) return refuse("Choose how serious it is: high, medium or low."); next.seriousness = clean(patch.seriousness, 10); }
    if (patch.mitigation !== undefined) next.mitigation = clean(patch.mitigation, 1000);
    if (sameEntry(p, next.kind ?? "", next.title ?? "", index)) return refuse("That is already on the list.");
    return { ok: true, proposal: { ...p, risks: p.risks.map((r, i) => (i === index ? { ...r, value: next, status: "EDITED" as const } : r)) } };
  },
};

export function applyRiskOperation(proposal: ProjectSetupProposal, op: RiskOperation): RiskOperationResult {
  const handler = RISK_OPERATIONS[op.kind] as (p: ProjectSetupProposal, o: RiskOperation) => RiskOperationResult;
  return handler(proposal, op);
}
