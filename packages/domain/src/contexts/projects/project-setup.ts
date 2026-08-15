import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

/** Operational provisioning state for a project's external workspace (Drive/Local). */
export type WorkspaceProvisionStatus = "NOT_REQUIRED" | "PENDING" | "IN_PROGRESS" | "READY" | "FAILED";

export const WORKSPACE_PROVISION_STATUSES: WorkspaceProvisionStatus[] = [
  "NOT_REQUIRED",
  "PENDING",
  "IN_PROGRESS",
  "READY",
  "FAILED",
];

export interface ProjectSetupProps {
  workspaceProvisionStatus: WorkspaceProvisionStatus;
  workspaceProvisionError?: string;
  provisionAttemptCount: number;
  lastProvisionAttemptAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedById?: string;
}

export class ProjectSetup extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    readonly projectId: string,
    private props: ProjectSetupProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: string;
    projectId: string;
    status?: WorkspaceProvisionStatus;
    provisionAttemptCount?: number;
  }): ProjectSetup {
    const status = input.status ?? "PENDING";
    if (!WORKSPACE_PROVISION_STATUSES.includes(status)) {
      throw DomainError.validation("Invalid workspace provision status");
    }
    return new ProjectSetup(input.id, input.tenantId, input.projectId, {
      workspaceProvisionStatus: status,
      provisionAttemptCount: input.provisionAttemptCount ?? 0,
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    projectId: string;
    props: ProjectSetupProps;
    createdAt: Date;
  }): ProjectSetup {
    return new ProjectSetup(input.id, input.tenantId, input.projectId, input.props, input.createdAt);
  }

  get workspaceProvisionStatus(): WorkspaceProvisionStatus {
    return this.props.workspaceProvisionStatus;
  }

  get workspaceProvisionError(): string | undefined {
    return this.props.workspaceProvisionError;
  }

  get provisionAttemptCount(): number {
    return this.props.provisionAttemptCount;
  }

  get lastProvisionAttemptAt(): Date | undefined {
    return this.props.lastProvisionAttemptAt ? new Date(this.props.lastProvisionAttemptAt.getTime()) : undefined;
  }

  get acknowledgedAt(): Date | undefined {
    return this.props.acknowledgedAt ? new Date(this.props.acknowledgedAt.getTime()) : undefined;
  }

  get acknowledgedById(): string | undefined {
    return this.props.acknowledgedById;
  }

  /** Marks the workspace as not required (e.g. LOCAL/R2 storage providers). */
  markNotRequired(): void {
    this.props.workspaceProvisionStatus = "NOT_REQUIRED";
    this.touch();
  }

  beginProvision(): void {
    if (this.props.workspaceProvisionStatus === "READY" || this.props.workspaceProvisionStatus === "NOT_REQUIRED") {
      throw DomainError.invalidTransition(
        `Cannot start provisioning from ${this.props.workspaceProvisionStatus}`,
      );
    }
    this.props.workspaceProvisionStatus = "IN_PROGRESS";
    this.props.provisionAttemptCount += 1;
    this.props.lastProvisionAttemptAt = new Date();
    this.props.workspaceProvisionError = undefined;
    this.touch();
  }

  markReady(): void {
    this.props.workspaceProvisionStatus = "READY";
    this.props.workspaceProvisionError = undefined;
    this.touch();
  }

  markFailed(error: string): void {
    this.props.workspaceProvisionStatus = "FAILED";
    this.props.workspaceProvisionError = error;
    this.touch();
  }

  acknowledge(byUserId: string): void {
    if (this.props.acknowledgedAt) return; // idempotent
    this.props.acknowledgedAt = new Date();
    this.props.acknowledgedById = byUserId;
    this.touch();
  }

  /** True when the workspace layer is ready (READY or explicitly NOT_REQUIRED). */
  isWorkspaceReady(): boolean {
    return this.props.workspaceProvisionStatus === "READY" || this.props.workspaceProvisionStatus === "NOT_REQUIRED";
  }
}
