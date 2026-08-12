import type { Role } from "../contexts/identity/role.js";

export type FieldPermission = "read" | "write" | "none";

export interface FieldPolicy {
  fieldPath: string;
  permission: FieldPermission;
  conditions?: FieldCondition[];
}

export interface FieldCondition {
  field: string;
  operator: "equals" | "in" | "not_equals" | "not_in" | "greater_than" | "less_than";
  value: string | number | boolean | string[] | number[];
}

export interface SubjectContext {
  userId: string;
  tenantId: string;
  role: Role;
  assignedProjectIds: string[];
  organizationType?: string;
  sector?: string;
  dataResidency?: string;
}

export interface ResourceContext {
  resourceType: string;
  resourceId: string;
  ownerTenantId: string;
  ownerProjectId?: string;
  sensitivityLevel?: "public" | "internal" | "confidential" | "restricted";
  financialData?: boolean;
}

const FINANCIAL_FIELDS: Record<string, FieldPolicy[]> = {
  Project: [
    { fieldPath: "budgetAmount", permission: "none", conditions: [{ field: "role", operator: "not_in", value: ["ADMIN", "GRANTS_OFFICER", "PROJECT_MANAGER"] }] },
    { fieldPath: "budgetCurrency", permission: "none", conditions: [{ field: "role", operator: "not_in", value: ["ADMIN", "GRANTS_OFFICER", "PROJECT_MANAGER"] }] },
    { fieldPath: "financialNotes", permission: "none", conditions: [{ field: "role", operator: "not_in", value: ["ADMIN", "GRANTS_OFFICER"] }] },
    { fieldPath: "expenditureToDate", permission: "none", conditions: [{ field: "role", operator: "not_in", value: ["ADMIN", "GRANTS_OFFICER"] }] },
  ],
  ActivityUpdate: [
    { fieldPath: "budgetSpent", permission: "none", conditions: [{ field: "role", operator: "not_in", value: ["ADMIN", "GRANTS_OFFICER"] }] },
    { fieldPath: "financialNotes", permission: "none", conditions: [{ field: "role", operator: "not_in", value: ["ADMIN", "GRANTS_OFFICER"] }] },
  ],
  Indicator: [
    { fieldPath: "unitCost", permission: "none", conditions: [{ field: "role", operator: "not_in", value: ["ADMIN", "GRANTS_OFFICER"] }] },
    { fieldPath: "budgetAllocation", permission: "none", conditions: [{ field: "role", operator: "not_in", value: ["ADMIN", "GRANTS_OFFICER"] }] },
  ],
};

const SENSITIVITY_FIELDS: Record<string, FieldPolicy[]> = {
  EvidenceFile: [
    { fieldPath: "fileUrl", permission: "none", conditions: [{ field: "sensitivityLevel", operator: "equals", value: "restricted" }] },
    { fieldPath: "aiSummary", permission: "none", conditions: [{ field: "sensitivityLevel", operator: "equals", value: "restricted" }] },
  ],
  ActivityUpdate: [
    { fieldPath: "beneficiaryNames", permission: "none", conditions: [{ field: "role", operator: "not_in", value: ["ADMIN", "ME_OFFICER", "PROJECT_MANAGER"] }] },
    { fieldPath: "beneficiaryLocation", permission: "none", conditions: [{ field: "sensitivityLevel", operator: "equals", value: "restricted" }] },
  ],
  ReportDraft: [
    { fieldPath: "unsupportedClaims", permission: "none", conditions: [{ field: "role", operator: "not_in", value: ["ADMIN", "COMPLIANCE_OFFICER"] }] },
  ],
};

export class ABACFieldPolicyEngine {
  static getFieldMask(
    subject: SubjectContext,
    resource: ResourceContext,
    requestedFields: string[],
  ): Record<string, FieldPermission> {
    const mask: Record<string, FieldPermission> = {};

    const outsideProjectScope = resource.ownerProjectId !== undefined
      && subject.role !== "ADMIN"
      && !subject.assignedProjectIds.includes(resource.ownerProjectId);
    if (subject.tenantId !== resource.ownerTenantId || outsideProjectScope) {
      for (const field of requestedFields) {
        mask[field] = "none";
      }
      return mask;
    }

    const policies = [
      ...(FINANCIAL_FIELDS[resource.resourceType] ?? []),
      ...(SENSITIVITY_FIELDS[resource.resourceType] ?? []),
    ];

    for (const field of requestedFields) {
      const fieldPolicies = policies.filter((p) => {
        if (p.fieldPath === "*") return true;
        if (p.fieldPath === field) return true;
        if (field.startsWith(p.fieldPath + ".")) return true;
        return false;
      });

      let permission: FieldPermission = "read";

      for (const policy of fieldPolicies) {
        if (policy.conditions && !this.evaluateConditions(policy.conditions, subject, resource)) {
          continue;
        }
        const policyPerm = policy.permission;
        if (policyPerm === "none") {
          permission = "none";
          break;
        }
        if (policyPerm === "write") {
          permission = "write";
        }
      }

      mask[field] = permission;
    }

    return mask;
  }

  static applyFieldMask<T extends object>(
    subject: SubjectContext,
    resource: ResourceContext,
    data: T,
    fieldMask: Record<string, FieldPermission>,
  ): Partial<T> {
    const masked: Partial<T> = {};

    for (const [key, value] of Object.entries(data)) {
      const permission = fieldMask[key] ?? "none";
      if (permission !== "none") {
        masked[key as keyof T] = value;
      }
    }

    return masked;
  }

  private static evaluateConditions(
    conditions: FieldCondition[],
    subject: SubjectContext,
    resource: ResourceContext,
  ): boolean {
    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, subject, resource)) {
        return false;
      }
    }
    return true;
  }

  private static evaluateCondition(
    condition: FieldCondition,
    subject: SubjectContext,
    resource: ResourceContext,
  ): boolean {
    let actual: string | number | boolean | undefined;

    if (condition.field.startsWith("subject.")) {
      actual = (subject as unknown as Record<string, unknown>)[condition.field.replace("subject.", "")] as string | number | boolean;
    } else if (condition.field.startsWith("resource.")) {
      actual = (resource as unknown as Record<string, unknown>)[condition.field.replace("resource.", "")] as string | number | boolean;
    } else {
      actual = (subject as unknown as Record<string, unknown>)[condition.field] as string | number | boolean;
    }

    if (actual === undefined) return false;

    switch (condition.operator) {
      case "equals":
        return actual === condition.value;
      case "not_equals":
        return actual !== condition.value;
      case "in":
        return Array.isArray(condition.value) && (condition.value as unknown[]).includes(actual);
      case "not_in":
        return Array.isArray(condition.value) && !(condition.value as unknown[]).includes(actual);
      case "greater_than":
        return typeof actual === "number" && typeof condition.value === "number" && actual > condition.value;
      case "less_than":
        return typeof actual === "number" && typeof condition.value === "number" && actual < condition.value;
      default:
        return false;
    }
  }

  static canAccessField(subject: SubjectContext, resource: ResourceContext, fieldPath: string): FieldPermission {
    const mask = this.getFieldMask(subject, resource, [fieldPath]);
    return mask[fieldPath] ?? "none";
  }

  static getRedactedJson<T extends object>(
    subject: SubjectContext,
    resource: ResourceContext,
    data: T,
    requestedFields: string[],
  ): string {
    const fieldMask = this.getFieldMask(subject, resource, requestedFields);
    const masked = this.applyFieldMask(subject, resource, data, fieldMask);
    return JSON.stringify(masked);
  }
}
