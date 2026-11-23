import { DomainError } from "../core/domain-error.js";
import type { Role } from "../contexts/identity/role.js";

export type Permission =
  | "org.manage"
  | "users.manage"
  | "project.create"
  | "project.edit"
  | "project.delete"
  | "project.view"
  | "template.manage"
  | "logframe.manage"
  | "indicator.update"
  | "indicator.verify"
  | "evidence.upload"
  | "evidence.verify"
  | "evidence.delete"
  | "activity.create"
  | "activity.approve"
  | "report.generate"
  | "report.edit"
  | "report.approve"
  | "report.export"
  | "report.resolve-claim"
  | "report.override-confidentiality"
  | "report.manage-agent-memory"
  | "checklist.manage"
  | "comment.create"
  | "audit.view"
  | "billing.manage"
  | "workplan.manage"
  | "workplan.update-own"
  | "task.assign"
  | "team.view-work"
  | "risk.raise"
  | "risk.manage"
  | "finance.approve"
  | "dataset.manage"
  | "dataset.contribute"
  | "collection.submit"
  /** See the project's money: finance register, budget, funding, rates, billing. Every role but the field officer (Phase 63). */
  | "finance.view"
  /** See the project's analysis across everyone's records: data sheet, management report, portfolio, framework versions. */
  | "results.view";

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  ADMIN: new Set<Permission>([
    "org.manage", "users.manage",
    "project.create", "project.edit", "project.delete", "project.view",
    "template.manage",
    "logframe.manage",
    "indicator.update", "indicator.verify",
    "evidence.upload", "evidence.verify", "evidence.delete",
    "activity.create", "activity.approve",
    "report.generate", "report.edit", "report.approve", "report.export", "report.resolve-claim", "report.override-confidentiality", "report.manage-agent-memory",
    "checklist.manage", "comment.create", "audit.view", "billing.manage",
    "workplan.manage", "workplan.update-own",
    "task.assign", "team.view-work",
    "risk.raise", "risk.manage",
    "finance.approve",
    "dataset.manage", "dataset.contribute",
    "collection.submit",
      "finance.view", "results.view",
  ]),
  PROJECT_MANAGER: new Set<Permission>([
    "project.edit", "project.view",
    "template.manage",
    "logframe.manage",
    "indicator.update", "indicator.verify",
    "evidence.upload", "evidence.verify",
    "activity.create", "activity.approve",
    "report.generate", "report.edit", "report.approve", "report.export", "report.resolve-claim", "report.manage-agent-memory",
    "checklist.manage", "comment.create", "audit.view",
    "workplan.manage", "workplan.update-own",
    "task.assign", "team.view-work",
    "risk.raise", "risk.manage",
    "finance.approve",
    "dataset.manage", "dataset.contribute",
    "collection.submit",
      "finance.view", "results.view",
  ]),
  ME_OFFICER: new Set<Permission>([
    "project.view",
    "logframe.manage",
    "indicator.update", "indicator.verify",
    "evidence.upload", "evidence.verify",
    "activity.create",
    "report.generate", "report.edit",
    "checklist.manage", "comment.create",
    "workplan.manage", "workplan.update-own",
    "task.assign", "team.view-work",
    "risk.raise", "risk.manage",
    "collection.submit",
      "finance.view", "results.view",
  ]),
  GRANTS_OFFICER: new Set<Permission>([
    "project.view",
    "template.manage",
    "evidence.upload",
    "report.generate", "report.edit", "report.export", "report.override-confidentiality",
    "checklist.manage", "comment.create",
    "workplan.update-own",
    "task.assign",
    "risk.raise", "risk.manage",
      "finance.view", "results.view",
  ]),
  FIELD_OFFICER: new Set<Permission>([
    "project.view",
    "dataset.contribute",
    "evidence.upload",
    "activity.create",
    "comment.create",
    "workplan.update-own",
    "risk.raise",
    "collection.submit",
  ]),
  COMPLIANCE_OFFICER: new Set<Permission>([
    "project.view",
    "evidence.upload", "evidence.verify",
    "checklist.manage",
    "comment.create", "audit.view",
    "workplan.update-own",
    "task.assign",
    "risk.raise", "risk.manage",
      "finance.view", "results.view",
  ]),
  VIEWER: new Set<Permission>([
    "project.view", "report.export",
      "finance.view", "results.view",
  ]),
};

export class Permissions {
  static for(role: Role): ReadonlySet<Permission> {
    return ROLE_PERMISSIONS[role];
  }

  static can(role: Role, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role].has(permission);
  }

  static require(role: Role, permission: Permission): void {
    if (!Permissions.can(role, permission)) {
      throw DomainError.forbidden("You do not have permission for this", { role, permission });
    }
  }

  static hasAny(role: Role, permissions: Permission[]): boolean {
    const p = ROLE_PERMISSIONS[role];
    return permissions.some((perm) => p.has(perm));
  }
}
