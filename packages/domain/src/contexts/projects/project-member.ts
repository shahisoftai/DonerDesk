import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import { TenantId } from "../../value-objects/tenant-id.js";
import type { Role } from "../identity/role.js";

export type ProjectMemberStatus = "ACTIVE" | "REMOVED";

export const PROJECT_MEMBER_STATUSES: ProjectMemberStatus[] = ["ACTIVE", "REMOVED"];

export interface ProjectMemberProps {
  projectId: string;
  userId: string;
  role: Role;
  status: ProjectMemberStatus;
  assignedById: string;
  assignedAt: Date;
}

export class ProjectMember extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantId: TenantId,
    private props: ProjectMemberProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: TenantId;
    projectId: string;
    userId: string;
    role: Role;
    assignedById: string;
  }): ProjectMember {
    if (!input.role) throw DomainError.validation("Role is required for a project member");
    if (!input.projectId) throw DomainError.validation("Project id is required");
    if (!input.userId) throw DomainError.validation("User id is required");
    return new ProjectMember(input.id, input.tenantId, {
      projectId: input.projectId,
      userId: input.userId,
      role: input.role,
      status: "ACTIVE",
      assignedById: input.assignedById,
      assignedAt: new Date(),
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: TenantId;
    props: ProjectMemberProps;
    createdAt: Date;
  }): ProjectMember {
    return new ProjectMember(input.id, input.tenantId, input.props, input.createdAt);
  }

  get projectId(): string { return this.props.projectId; }
  get userId(): string { return this.props.userId; }
  get role(): Role { return this.props.role; }
  get status(): ProjectMemberStatus { return this.props.status; }
  get assignedById(): string { return this.props.assignedById; }
  get assignedAt(): Date { return new Date(this.props.assignedAt.getTime()); }

  changeRole(role: Role): void {
    if (this.props.status !== "ACTIVE") throw DomainError.invalidTransition("Cannot change the role of a removed member");
    if (!role) throw DomainError.validation("Role is required");
    this.props.role = role;
    this.touch();
  }

  remove(): void {
    if (this.props.status === "REMOVED") throw DomainError.invalidTransition("Member is already removed");
    this.props.status = "REMOVED";
    this.touch();
  }

  toValue(): ProjectMemberProps {
    return { ...this.props, assignedAt: new Date(this.props.assignedAt.getTime()) };
  }
}
