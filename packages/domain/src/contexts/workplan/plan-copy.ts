/**
 * "Copy the work plan" with a project's setup: titles, kinds, logframe activities, lengths and offsets from the project
 * start. Never owners, statuses, completed activities, or dates outside the target project (those are dropped with a note).
 */
import { addDays, compareDates, daysBetween, type PlainDate } from "./plain-date.js";

export interface CopySourceItem {
  title: string;
  description: string;
  location?: string;
  /** The logframe node id in the SOURCE project; mapped to the target's node by `nodeMap`. */
  logframeActivityId?: string;
  plannedStart: PlainDate;
  plannedEnd: PlainDate;
  targetParticipants?: number;
  targetCount?: number;
  status: string;
}

export interface CopiedPlanItem {
  title: string;
  description: string;
  location?: string;
  logframeActivityId?: string;
  plannedStart: PlainDate;
  plannedEnd: PlainDate;
  targetParticipants?: number;
  targetCount?: number;
}

export interface PlanCopyResult {
  items: CopiedPlanItem[];
  skipped: Array<{ title: string; reason: string }>;
}

export function planWorkPlanCopy(
  source: ReadonlyArray<CopySourceItem>,
  from: { start: PlainDate },
  to: { start: PlainDate; end: PlainDate },
  nodeMap: ReadonlyMap<string, string>,
): PlanCopyResult {
  const items: CopiedPlanItem[] = [];
  const skipped: PlanCopyResult["skipped"] = [];
  const offset = daysBetween(from.start, to.start);
  for (const s of source) {
    if (s.status === "CANCELLED") { skipped.push({ title: s.title, reason: "it was cancelled" }); continue; }
    const start = addDays(s.plannedStart, offset);
    const end = addDays(s.plannedEnd, offset);
    if (compareDates(start, to.end) > 0) { skipped.push({ title: s.title, reason: "it falls after the new project ends" }); continue; }
    const node = s.logframeActivityId ? nodeMap.get(s.logframeActivityId) : undefined;
    items.push({
      title: s.title, description: s.description,
      ...(s.location ? { location: s.location } : {}),
      ...(node ? { logframeActivityId: node } : {}),
      plannedStart: start, plannedEnd: compareDates(end, to.end) > 0 ? to.end : end,
      ...(s.targetParticipants !== undefined ? { targetParticipants: s.targetParticipants } : {}),
      ...(s.targetCount !== undefined ? { targetCount: s.targetCount } : {}),
    });
  }
  return { items, skipped };
}
