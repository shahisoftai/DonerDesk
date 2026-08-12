import { DomainEvent } from "../../core/domain-event.js";
import { TenantId } from "../../value-objects/tenant-id.js";
import type { TemplateSection } from "./template-section.js";

export class TemplateUploaded extends DomainEvent {
  readonly eventName = "template.uploaded";
  constructor(
    public readonly tenantId: TenantId,
    public readonly templateId: string,
    public readonly projectId: string,
    public readonly donorName: string,
  ) {
    super();
  }
}

export class TemplateExtracted extends DomainEvent {
  readonly eventName = "template.extracted";
  constructor(
    public readonly tenantId: TenantId,
    public readonly templateId: string,
    public readonly sectionCount: number,
    public readonly sections: TemplateSection[],
  ) {
    super();
  }
}
