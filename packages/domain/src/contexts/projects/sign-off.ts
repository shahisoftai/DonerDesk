/**
 * Who can sign a report off, read from every place a person can be assigned to a project, in one function. A project
 * names a manager, an M&E officer and a reporting officer on itself *and* has members with roles; the closing plan
 * and the setup check each read only one of those, so they disagreed with what the user had done (demo 5).
 */
export interface SignOffFacts {
  projectManagerId?: string | undefined;
  meOfficerId?: string | undefined;
  reportingOfficerId?: string | undefined;
  members: ReadonlyArray<{ userId: string; role: string; status: string }>;
}

export interface SignOffRoles {
  /** Someone is assigned to manage the project (its own field, or an active member who is a project manager). */
  projectManager: boolean;
  meOfficer: boolean;
  reportingOfficer: boolean;
  /** Anyone at all is assigned to the project. */
  anyoneAssigned: boolean;
  /** User ids that hold a sign-off role; the report's approver is one of them. */
  approverIds: string[];
}

const ACTIVE = "ACTIVE";

export function signOffRoles(facts: SignOffFacts): SignOffRoles {
  const active = facts.members.filter((m) => m.status === ACTIVE);
  const holders = (role: string, fieldId: string | undefined): string[] => [
    ...(fieldId ? [fieldId] : []),
    ...active.filter((m) => m.role === role).map((m) => m.userId),
  ];
  const pm = holders("PROJECT_MANAGER", facts.projectManagerId);
  const me = holders("ME_OFFICER", facts.meOfficerId);
  const reporting = holders("GRANTS_OFFICER", facts.reportingOfficerId);
  return {
    projectManager: pm.length > 0,
    meOfficer: me.length > 0,
    reportingOfficer: reporting.length > 0,
    anyoneAssigned: Boolean(facts.projectManagerId || facts.meOfficerId || facts.reportingOfficerId) || active.length > 0,
    approverIds: [...new Set([...pm, ...me])],
  };
}

export type ApproverCheck = { ok: true; selfApproval: boolean } | { ok: false; reason: string };

/**
 * May this person approve the report? When the project requires a second approver, the author cannot (and the message
 * says who can). Otherwise anyone with the right may, and approving your own report is flagged so it is recorded
 * (`selfApproval`): a team of one signs off as both, openly.
 */
export function checkApprover(input: { requireSecondApprover: boolean; authorId: string | undefined; approverId: string; otherApproverCount: number }): ApproverCheck {
  const self = input.authorId !== undefined && input.authorId === input.approverId;
  if (!self) return { ok: true, selfApproval: false };
  if (!input.requireSecondApprover) return { ok: true, selfApproval: true };
  return {
    ok: false,
    reason:
      input.otherApproverCount > 0
        ? "This project needs a second person to approve: you wrote this report, so a project manager or M&E officer other than you has to approve it."
        : "This project needs a second person to approve, and nobody else is assigned as a project manager or M&E officer yet. Assign one under Team, or switch the second-approver rule off in the project settings if you work alone.",
  };
}

/** Only an administrator or a project manager may attest to many items at once; everyone else decides them one by one. */
export function canBulkAttest(role: string | undefined): boolean {
  return role === "ADMIN" || role === "PROJECT_MANAGER";
}
