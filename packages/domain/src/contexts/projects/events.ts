import { DomainEvent } from "../../core/domain-event.js";
import { TenantId } from "../../value-objects/tenant-id.js";
import type { ProjectStatus } from "./project.js";

export class ProjectCreated extends DomainEvent {
  readonly eventName = "project.created";
  constructor(public readonly tenantId: TenantId, public readonly projectId: string, public readonly title: string) {
    super();
  }
}

export class ProjectStatusChanged extends DomainEvent {
  readonly eventName = "project.status_changed";
  constructor(
    public readonly tenantId: TenantId,
    public readonly projectId: string,
    public readonly from: ProjectStatus,
    public readonly to: ProjectStatus,
  ) {
    super();
  }
}

export class ProjectWorkspaceProvisionRequested extends DomainEvent {
  readonly eventName = "project.workspace.provision_requested";
  constructor(public readonly tenantId: TenantId, public readonly projectId: string) {
    super();
  }
}

export class ProjectWorkspaceProvisioned extends DomainEvent {
  readonly eventName = "project.workspace.provisioned";
  constructor(public readonly tenantId: TenantId, public readonly projectId: string, public readonly rootId: string) {
    super();
  }
}
