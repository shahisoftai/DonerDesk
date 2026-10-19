/**
 * Words for "Problems and risks": the kind, the seriousness, the review date and the one line under a problem.
 * Never PROBLEM / RISK / HIGH in front of a person. Pure.
 */
import { RISK_KIND_LABEL, SERIOUSNESS_LABEL } from "@donordesk/domain/contexts/risks/index.js";
import { formatShortDate } from "@donordesk/domain/contexts/workplan/index.js";

export interface RiskShape {
  kind: "PROBLEM" | "RISK" | "ASSUMPTION" | "DECISION" | "DEPENDENCY";
  seriousness: "HIGH" | "MEDIUM" | "LOW";
  ownerId?: string | undefined;
  action: string;
  reviewBy?: string | undefined;
  status: "OPEN" | "CLOSED";
  closedNote?: string | undefined;
}

export const riskKindWords = (kind: RiskShape["kind"]): string => RISK_KIND_LABEL[kind];
export const seriousnessWords = (s: RiskShape["seriousness"]): string => SERIOUSNESS_LABEL[s];

/** "Amina is handling it · Looked at again 9 Apr", "Nobody is handling it yet", or how it ended. */
export function riskLine(r: RiskShape, userId: string, names: Readonly<Record<string, string>>, today: string): string {
  if (r.status === "CLOSED") return r.closedNote ? `Closed: ${r.closedNote}` : "Closed";
  const who = r.ownerId ? `${r.ownerId === userId ? "You are" : `${names[r.ownerId] ?? "A team member"} is`} handling it` : "Nobody is handling it yet";
  return r.reviewBy ? `${who} · Looked at again ${formatShortDate(r.reviewBy, today)}` : who;
}
