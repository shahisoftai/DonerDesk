/**
 * Review and approval of a design (Phase 32.9). One status table decides which moves exist; the
 * approver rule is the same shape as the report's second-approver rule. An edit to an approved
 * design returns it to DRAFT, because what was approved is no longer what is on screen.
 */
export type DesignStatus = "DRAFT" | "IN_REVIEW" | "APPROVED";
export const DESIGN_STATUSES: readonly DesignStatus[] = ["DRAFT", "IN_REVIEW", "APPROVED"];
export type DesignAction = "REQUEST_REVIEW" | "APPROVE" | "RETURN" | "EDIT";

export const DESIGN_TRANSITIONS: Readonly<Record<DesignStatus, Partial<Record<DesignAction, DesignStatus>>>> = {
  DRAFT: { REQUEST_REVIEW: "IN_REVIEW", EDIT: "DRAFT" },
  IN_REVIEW: { APPROVE: "APPROVED", RETURN: "DRAFT", EDIT: "DRAFT" },
  APPROVED: { RETURN: "DRAFT", EDIT: "DRAFT" },
};

export function nextStatus(status: DesignStatus, action: DesignAction): DesignStatus | undefined {
  return DESIGN_TRANSITIONS[status][action];
}

export function canApplyDesignAction(status: DesignStatus, action: DesignAction): boolean {
  return nextStatus(status, action) !== undefined;
}

export const DESIGN_STATUS_LABEL: Readonly<Record<DesignStatus, string>> = { DRAFT: "Draft", IN_REVIEW: "In review", APPROVED: "Approved" };

/**
 * Who may approve: someone other than the person who asked for the review. When only one person
 * can approve (a small team), self-approval is allowed but recorded as such, so the audit trail
 * says plainly that nobody else looked.
 */
export function checkDesignApprover(input: { approverId: string; requestedById?: string; otherApproversExist: boolean }): { allowed: boolean; self: boolean; reason?: string } {
  const self = Boolean(input.requestedById) && input.approverId === input.requestedById;
  if (!self) return { allowed: true, self: false };
  if (input.otherApproversExist) return { allowed: false, self: true, reason: "Another approver must review a design you asked to have reviewed." };
  return { allowed: true, self: true };
}

/** How long a public link lasts: from one day to ninety; the default is thirty. */
export const SHARE_LINK_DEFAULT_DAYS = 30;
export const SHARE_LINK_MAX_DAYS = 90;

export function shareLinkExpiry(now: Date, days: number | undefined): Date {
  const d = Math.min(Math.max(Math.round(days ?? SHARE_LINK_DEFAULT_DAYS), 1), SHARE_LINK_MAX_DAYS);
  return new Date(now.getTime() + d * 86_400_000);
}

export function isShareLinkLive(link: { expiresAt: Date; revokedAt?: Date | null }, now: Date): boolean {
  return !link.revokedAt && link.expiresAt.getTime() > now.getTime();
}
