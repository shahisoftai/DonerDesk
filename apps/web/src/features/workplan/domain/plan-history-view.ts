/**
 * One line of the activity's history in words: "end date: 12 Mar to 20 Mar", "status: Not started to Under way",
 * "lead: Amina to you". Never a raw code, id or ISO date. Pure.
 */
import { fileWords } from "./file-needs-view.ts";
import { formatShortDate, PLAN_STATUS_LABEL, type PlanStatus } from "@donordesk/domain/contexts/workplan/index.js";

const FIELD_WORD: Readonly<Record<string, string>> = {
  plannedStart: "start date", plannedEnd: "end date", status: "status", ownerUserId: "lead", supportUserIds: "helpers",
  targetCount: "number of sessions", targetParticipants: "people expected", title: "title", location: "place", description: "notes",
  logframeActivityId: "logframe activity", requiredFiles: "files we will need",
};

const NONE = "none";

export interface HistoryContext {
  today: string;
  userId: string;
  names: Readonly<Record<string, string>>;
}

function person(id: unknown, ctx: HistoryContext): string {
  if (typeof id !== "string" || !id) return NONE;
  return id === ctx.userId ? "you" : (ctx.names[id] ?? "a team member");
}

function value(field: string, v: unknown, ctx: HistoryContext): string {
  if (v === null || v === undefined || v === "") return NONE;
  if (field === "status" && typeof v === "string") return (PLAN_STATUS_LABEL as Record<string, string>)[v as PlanStatus] ?? "changed";
  if ((field === "plannedStart" || field === "plannedEnd") && typeof v === "string") return formatShortDate(v, ctx.today);
  if (field === "ownerUserId") return person(v, ctx);
  if (field === "supportUserIds" && Array.isArray(v)) return v.length === 0 ? NONE : v.map((id) => person(id, ctx)).join(", ");
  if (field === "requiredFiles" && Array.isArray(v)) return v.length === 0 ? NONE : fileWords(v.map(String));
  if (field === "logframeActivityId") return "linked";
  return typeof v === "string" || typeof v === "number" ? String(v) : "changed";
}

export function describeChange(field: string, change: { from?: unknown; to?: unknown }, ctx: HistoryContext): string {
  return `${FIELD_WORD[field] ?? "details"}: ${value(field, change.from, ctx)} to ${value(field, change.to, ctx)}`;
}

export function describeChanges(changes: Readonly<Record<string, { from?: unknown; to?: unknown }>>, ctx: HistoryContext): string {
  return Object.entries(changes).map(([field, change]) => describeChange(field, change, ctx)).join("; ");
}
