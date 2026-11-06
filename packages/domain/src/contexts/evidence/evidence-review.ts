import type { EvidenceVerificationStatus } from "./evidence-file.js";

/**
 * What a reviewer may do with a piece of evidence, as one table: which states each action starts from, where it leads, and whether a
 * reason is required. The aggregate's own methods only set a state; this decides whether the move is allowed. Pure.
 */
export type EvidenceReviewAction = "VERIFY" | "REQUEST_CORRECTION" | "REJECT" | "ARCHIVE" | "RESTORE";

interface Rule {
  from: ReadonlyArray<EvidenceVerificationStatus>;
  to: EvidenceVerificationStatus;
  /** A reason the uploader and later reviewers can read. */
  needsNote: boolean;
  /** An approved or sent report may already rely on a verified file, so taking it out of use is checked against the reports. */
  checkReportUse: boolean;
}

const OPEN: ReadonlyArray<EvidenceVerificationStatus> = ["UPLOADED", "AI_TAGGED", "PENDING_REVIEW", "NEEDS_CORRECTION"];

export const EVIDENCE_REVIEW_RULES: Readonly<Record<EvidenceReviewAction, Rule>> = {
  VERIFY: { from: OPEN, to: "VERIFIED", needsNote: false, checkReportUse: false },
  REQUEST_CORRECTION: { from: ["UPLOADED", "AI_TAGGED", "PENDING_REVIEW", "VERIFIED"], to: "NEEDS_CORRECTION", needsNote: true, checkReportUse: false },
  REJECT: { from: [...OPEN, "VERIFIED"], to: "REJECTED", needsNote: true, checkReportUse: true },
  ARCHIVE: { from: [...OPEN, "VERIFIED", "REJECTED"], to: "ARCHIVED", needsNote: false, checkReportUse: true },
  RESTORE: { from: ["REJECTED", "ARCHIVED"], to: "PENDING_REVIEW", needsNote: false, checkReportUse: false },
};

export const EVIDENCE_REVIEW_LABEL: Readonly<Record<EvidenceReviewAction, string>> = {
  VERIFY: "verify",
  REQUEST_CORRECTION: "ask for a correction to",
  REJECT: "reject",
  ARCHIVE: "archive",
  RESTORE: "bring back",
};

export type EvidenceReviewCheck =
  | { ok: true; to: EvidenceVerificationStatus; checkReportUse: boolean }
  | { ok: false; reason: string };

export function checkEvidenceReview(status: EvidenceVerificationStatus, action: EvidenceReviewAction, note: string | undefined): EvidenceReviewCheck {
  const rule = EVIDENCE_REVIEW_RULES[action];
  if (!rule.from.includes(status)) {
    return { ok: false, reason: `You cannot ${EVIDENCE_REVIEW_LABEL[action]} a file that is ${status.toLowerCase().replace(/_/g, " ")}.` };
  }
  if (rule.needsNote && (note ?? "").trim() === "") return { ok: false, reason: "Say why, so the person who uploaded it knows what to fix." };
  return { ok: true, to: rule.to, checkReportUse: rule.checkReportUse };
}

/** Changing what a verified file is about (its period, its tags) means someone must look at it again. */
export function statusAfterRepoint(status: EvidenceVerificationStatus): EvidenceVerificationStatus {
  return status === "VERIFIED" ? "PENDING_REVIEW" : status;
}
