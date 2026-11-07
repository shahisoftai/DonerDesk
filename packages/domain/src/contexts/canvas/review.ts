/**
 * Review of a canvas that will be shared (Phase 45): one transition table, one publish rule, one snapshot schedule rule. Pure.
 * A change after approval puts the canvas back to a draft, so what was approved is always what is published.
 */
import { canPublish, checkCanvas } from "./governance.js";
import type { Canvas } from "./canvas.js";

export const REVIEW_STATUSES = ["DRAFT", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export const REVIEW_ACTIONS = ["SUBMIT", "APPROVE", "REQUEST_CHANGES", "REOPEN"] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

interface Transition { from: readonly ReviewStatus[]; to: ReviewStatus; reviewer: boolean; note: boolean }
/** Who may do what from where. A reviewer is someone who may approve; an author may submit and reopen their own. */
export const REVIEW_TRANSITIONS: Readonly<Record<ReviewAction, Transition>> = {
  SUBMIT: { from: ["DRAFT", "CHANGES_REQUESTED"], to: "IN_REVIEW", reviewer: false, note: false },
  APPROVE: { from: ["IN_REVIEW"], to: "APPROVED", reviewer: true, note: false },
  REQUEST_CHANGES: { from: ["IN_REVIEW"], to: "CHANGES_REQUESTED", reviewer: true, note: true },
  REOPEN: { from: ["IN_REVIEW", "APPROVED"], to: "DRAFT", reviewer: false, note: false },
};

export const asReviewStatus = (v: unknown): ReviewStatus => ((REVIEW_STATUSES as readonly unknown[]).includes(v) ? (v as ReviewStatus) : "DRAFT");

export type ReviewResult = { ok: true; status: ReviewStatus } | { ok: false; reason: string };
export function reviewTransition(status: ReviewStatus, action: ReviewAction, who: { isReviewer: boolean; note?: string | undefined }): ReviewResult {
  const t = REVIEW_TRANSITIONS[action];
  if (!t.from.includes(status)) return { ok: false, reason: `This cannot be done while the canvas is ${status.toLowerCase().replace(/_/g, " ")}.` };
  if (t.reviewer && !who.isReviewer) return { ok: false, reason: "Only someone who may approve can do this." };
  if (t.note && !who.note?.trim()) return { ok: false, reason: "Say what needs to change." };
  return { ok: true, status: t.to };
}

/** A saved change to the document puts a reviewed canvas back to a draft. */
export const statusAfterEdit = (_status: ReviewStatus): ReviewStatus => "DRAFT";

/** Why a canvas cannot be published as a file yet, or null. A shared design must pass the Design check; one for a donor must also be approved. */
export function publishBlocker(canvas: Canvas, status: ReviewStatus): string | null {
  if (canvas.mode === "PUBLISHED_ONLY" || canvas.profile === "DONOR_REPORT") {
    const findings = checkCanvas(canvas);
    if (!canPublish(findings)) return `The Design check has something to fix first: ${findings.find((f) => f.severity === "BLOCKER")?.message ?? "see the check."}`;
  }
  if (canvas.profile === "DONOR_REPORT" && status !== "APPROVED") return "A canvas for a donor must be approved before it is published. Submit it for review.";
  return null;
}

export const SNAPSHOT_SCHEDULES = ["NONE", "WEEKLY", "MONTHLY"] as const;
export type SnapshotSchedule = (typeof SNAPSHOT_SCHEDULES)[number];
export const asSnapshotSchedule = (v: unknown): SnapshotSchedule => ((SNAPSHOT_SCHEDULES as readonly unknown[]).includes(v) ? (v as SnapshotSchedule) : "NONE");
const DAYS: Record<SnapshotSchedule, number> = { NONE: Infinity, WEEKLY: 7, MONTHLY: 30 };
/** A snapshot is due once the schedule's days have passed since the last one (or when there has never been one). */
export function snapshotDue(schedule: SnapshotSchedule, last: Date | undefined, now: Date): boolean {
  if (schedule === "NONE") return false;
  return !last || (now.getTime() - last.getTime()) / 86_400_000 >= DAYS[schedule];
}
