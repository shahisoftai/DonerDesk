import { DomainEvent } from "../../core/domain-event.js";
import { TenantId } from "../../value-objects/tenant-id.js";
import type { SuggestedTag } from "./evidence-file.js";

export class EvidenceUploaded extends DomainEvent {
  readonly eventName = "evidence.uploaded";
  constructor(
    public readonly tenantId: TenantId,
    public readonly evidenceId: string,
    public readonly projectId: string,
    public readonly uploadedById: string,
  ) {
    super();
  }
}

export class EvidenceTagged extends DomainEvent {
  readonly eventName = "evidence.tagged";
  constructor(
    public readonly tenantId: TenantId,
    public readonly evidenceId: string,
    public readonly tags: SuggestedTag[],
  ) {
    super();
  }
}

export class EvidenceVerified extends DomainEvent {
  readonly eventName = "evidence.verified";
  constructor(public readonly tenantId: TenantId, public readonly evidenceId: string, public readonly verifiedById: string) {
    super();
  }
}
