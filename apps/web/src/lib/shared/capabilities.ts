export type Role =
  | "ADMIN"
  | "PROJECT_MANAGER"
  | "ME_OFFICER"
  | "GRANTS_OFFICER"
  | "FIELD_OFFICER"
  | "COMPLIANCE_OFFICER"
  | "VIEWER";

export const ROLES: readonly Role[] = [
  "ADMIN",
  "PROJECT_MANAGER",
  "ME_OFFICER",
  "GRANTS_OFFICER",
  "FIELD_OFFICER",
  "COMPLIANCE_OFFICER",
  "VIEWER",
];

export type Capability =
  | "project.create"
  | "project.edit"
  | "project.setup"
  | "project.archive"
  | "org.manage"
  | "team.invite"
  | "team.manage"
  | "template.create"
  | "template.edit"
  | "logframe.edit"
  | "indicator.update"
  | "collection.submit"
  | "indicator.verify"
  | "activity.create"
  | "activity.review"
  | "evidence.upload"
  | "evidence.verify"
  | "reporting.create"
  | "reporting.edit"
  | "report.generate"
  | "report.approve"
  | "report.resolve-claim"
  | "report.override-confidentiality"
  | "report.manage-agent-memory"
  | "checklist.resolve"
  | "checklist.manage"
  | "export.create"
  | "audit.view"
  | "workplan.manage"
  | "workplan.update-own"
  | "task.assign"
  | "team.view-work"
  | "risk.raise"
  | "risk.manage"
  | "finance.approve"
  | "settings.view"
  | "billing.manage"
  /** The project's money and the analysis across everyone's records: every role except the field officer (Phase 63). */
  | "finance.view"
  | "results.view";

const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  ADMIN: [
    "project.create",
    "project.edit",
    "project.setup",
    "project.archive",
    "org.manage",
    "team.invite",
    "team.manage",
    "template.create",
    "template.edit",
    "logframe.edit",
    "indicator.update",
    "collection.submit",
    "indicator.verify",
    "activity.create",
    "activity.review",
    "evidence.upload",
    "evidence.verify",
    "reporting.create",
    "reporting.edit",
    "report.generate",
    "report.approve",
    "report.resolve-claim",
    "report.override-confidentiality",
    "report.manage-agent-memory",
    "checklist.resolve",
    "checklist.manage",
    "export.create",
    "audit.view",
    "settings.view",
    "billing.manage",
    "workplan.manage",
    "workplan.update-own",
    "task.assign",
    "team.view-work",
      "risk.raise",
    "risk.manage",
    "finance.approve",
    "finance.view",
    "results.view",
  ],
  PROJECT_MANAGER: [
    "project.create",
    "project.edit",
    "project.setup",
    "template.create",
    "template.edit",
    "logframe.edit",
    "indicator.update",
    "collection.submit",
    "indicator.verify",
    "activity.review",
    "evidence.verify",
    "reporting.create",
    "reporting.edit",
    "report.generate",
    "report.approve",
    "report.resolve-claim",
    "report.manage-agent-memory",
    "checklist.resolve",
    "export.create",
    "workplan.manage",
    "workplan.update-own",
    "task.assign",
    "team.view-work",
      "risk.raise",
    "risk.manage",
    "finance.approve",
    "finance.view",
    "results.view",
  ],
  ME_OFFICER: [
    "logframe.edit",
    "indicator.update",
    "collection.submit",
    "indicator.verify",
    "activity.review",
    "evidence.upload",
    "evidence.verify",
    "reporting.edit",
    "report.generate",
    "workplan.manage",
    "workplan.update-own",
    "task.assign",
    "team.view-work",
      "risk.raise",
    "risk.manage",
    "finance.view",
    "results.view",
  ],
  GRANTS_OFFICER: [
    "template.create",
    "template.edit",
    "reporting.edit",
    "report.generate",
    "report.approve",
    "report.override-confidentiality",
    "export.create",
    "workplan.update-own",
    "task.assign",
      "risk.raise",
    "risk.manage",
    "finance.view",
    "results.view",
  ],
  FIELD_OFFICER: ["activity.create", "evidence.upload", "workplan.update-own", "risk.raise", "collection.submit"],
  COMPLIANCE_OFFICER: [
    "checklist.resolve",
    "checklist.manage",
    "evidence.verify",
    "reporting.edit",
    "report.approve",
    "workplan.update-own",
    "task.assign",
      "risk.raise",
    "risk.manage",
    "finance.view",
    "results.view",
  ],
  VIEWER: ["export.create", "finance.view", "results.view"],
};

export function capabilitiesForRole(role: string | undefined): ReadonlySet<Capability> {
  if (!role || !(role in ROLE_CAPABILITIES)) return new Set<Capability>();
  const list = ROLE_CAPABILITIES[role as Role];
  return new Set(list);
}

export function can(
  capabilities: ReadonlySet<Capability> | readonly Capability[],
  capability: Capability,
): boolean {
  if ("has" in capabilities) return capabilities.has(capability);
  return capabilities.includes(capability);
}
