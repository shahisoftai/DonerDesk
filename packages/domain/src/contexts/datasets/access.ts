import type { Restriction } from "./model.js";
import { LAWFUL_BASES } from "./model.js";

/**
 * Who may do what with a dataset (§5, D3). Pure: callers pass the facts. Organisation datasets are managed by administrators; project
 * datasets by administrators and the project's managers. Contributors (field officers, outside partners on their projects) may add
 * data to an existing dataset; their uploads wait for a manager's acceptance. A restricted dataset (§8.2) is seen only by the people
 * named on it and never through a link, an embed, Ask or by an outside partner.
 */
export interface DatasetViewer { userId: string; canManageOrg: boolean; canManage: boolean; canContribute: boolean; external: boolean; isProjectManager: boolean }
export interface DatasetAccessFacts { scope: "PROJECT" | "ORGANISATION"; restricted: boolean; restriction?: Restriction | undefined; createdById: string }

export function canSeeDataset(d: DatasetAccessFacts, v: DatasetViewer): boolean {
  if (!d.restricted) return true;
  if (v.external) return false;
  return d.createdById === v.userId || Boolean(d.restriction?.viewerIds.includes(v.userId));
}

export function canManageDataset(d: DatasetAccessFacts, v: DatasetViewer): boolean {
  if (v.external || !canSeeDataset(d, v)) return false;
  return d.scope === "ORGANISATION" ? v.canManageOrg : v.canManage;
}

export const canContributeToDataset = (d: DatasetAccessFacts, v: DatasetViewer): boolean => canSeeDataset(d, v) && (canManageDataset(d, v) || v.canContribute);

/** A restriction (lawful basis, purpose, retention date, named viewers) checked before a dataset is made restricted. */
export function restrictionProblems(r: Restriction | undefined, today: string): string[] {
  if (!r) return ["Give the lawful basis, the purpose and how long the data is kept."];
  const out: string[] = [];
  if (!(LAWFUL_BASES as readonly string[]).includes(r.lawfulBasis)) out.push("Choose the lawful basis for keeping personal data.");
  if (r.purpose.trim().length < 10) out.push("Say in a sentence why person-level rows are needed.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.retainUntil) || r.retainUntil <= today) out.push("Choose the day the data is deleted or reviewed (in the future).");
  if (r.viewerIds.length > 50) out.push("Name at most 50 people who may see it.");
  return out;
}

/** The retention date has come: the dataset must be deleted or reviewed (a reminder goes to its owner). */
export const retentionDue = (r: Restriction | undefined, today: string): boolean => Boolean(r && r.retainUntil <= today);
