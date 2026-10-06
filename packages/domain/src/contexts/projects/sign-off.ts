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
