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
  | "org.manage"
  | "team.invite"
  | "team.manage"
  | "template.create"
  | "template.edit"
  | "logframe.edit"
  | "activity.create"
  | "activity.review"
  | "evidence.upload"
  | "evidence.verify"
  | "reporting.create"
  | "reporting.edit"
  | "report.generate"
  | "report.approve"
  | "checklist.resolve"
  | "checklist.manage"
  | "export.create"
  | "audit.view"
  | "settings.view";

const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  ADMIN: [
    "project.create",
    "project.edit",
    "org.manage",
    "team.invite",
    "team.manage",
    "template.create",
    "template.edit",
    "logframe.edit",
    "activity.create",
    "activity.review",
    "evidence.upload",
    "evidence.verify",
    "reporting.create",
    "reporting.edit",
    "report.generate",
    "report.approve",
    "checklist.resolve",
    "checklist.manage",
    "export.create",
    "audit.view",
    "settings.view",
  ],
  PROJECT_MANAGER: [
    "project.create",
    "project.edit",
    "template.create",
    "template.edit",
    "logframe.edit",
    "activity.review",
    "evidence.verify",
    "reporting.create",
    "reporting.edit",
    "report.generate",
    "report.approve",
    "checklist.resolve",
    "export.create",
  ],
  ME_OFFICER: [
    "logframe.edit",
    "activity.review",
    "evidence.upload",
    "evidence.verify",
    "reporting.edit",
    "report.generate",
  ],
  GRANTS_OFFICER: [
    "template.create",
    "template.edit",
    "reporting.edit",
    "report.generate",
    "report.approve",
    "export.create",
  ],
  FIELD_OFFICER: ["activity.create", "evidence.upload"],
  COMPLIANCE_OFFICER: [
    "checklist.resolve",
    "checklist.manage",
    "evidence.verify",
    "reporting.edit",
    "report.approve",
  ],
  VIEWER: [],
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
