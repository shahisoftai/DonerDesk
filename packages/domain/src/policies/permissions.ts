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
  | "checklist.manage"
  | "comment.create"
  | "audit.view"
  | "billing.manage";

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  ADMIN: new Set<Permission>([
    "org.manage", "users.manage",
    "project.create", "project.edit", "project.delete", "project.view",
    "template.manage",
    "logframe.manage",
    "indicator.update", "indicator.verify",
    "evidence.upload", "evidence.verify", "evidence.delete",
    "activity.create", "activity.approve",
    "report.generate", "report.edit", "report.approve", "report.export",
    "checklist.manage", "comment.create", "audit.view", "billing.manage",
  ]),
  PROJECT_MANAGER: new Set<Permission>([
    "project.edit", "project.view",
    "template.manage",
    "logframe.manage",
    "indicator.update", "indicator.verify",
    "evidence.upload", "evidence.verify",
    "activity.create", "activity.approve",
    "report.generate", "report.edit", "report.approve", "report.export",
    "checklist.manage", "comment.create", "audit.view",
  ]),
  ME_OFFICER: new Set<Permission>([
    "project.view",
    "logframe.manage",
    "indicator.update", "indicator.verify",
    "evidence.upload", "evidence.verify",
    "activity.create",
    "report.generate", "report.edit",
    "checklist.manage", "comment.create",
  ]),
  GRANTS_OFFICER: new Set<Permission>([
    "project.view",
    "template.manage",
    "evidence.upload",
    "report.generate", "report.edit", "report.export",
    "checklist.manage", "comment.create",
  ]),
  FIELD_OFFICER: new Set<Permission>([
    "project.view",
    "evidence.upload",
    "activity.create",
    "comment.create",
  ]),
  COMPLIANCE_OFFICER: new Set<Permission>([
    "project.view",
    "evidence.upload", "evidence.verify",
    "checklist.manage",
    "comment.create", "audit.view",
  ]),
  VIEWER: new Set<Permission>([
    "project.view",
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
      throw DomainError.forbidden(`Role ${role} lacks permission ${permission}`, { role, permission });
    }
  }

  static hasAny(role: Role, permissions: Permission[]): boolean {
    const p = ROLE_PERMISSIONS[role];
    return permissions.some((perm) => p.has(perm));
  }
}
