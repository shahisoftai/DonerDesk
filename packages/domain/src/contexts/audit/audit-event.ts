import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

export interface AuditEventProps {
  actorId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  projectId?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  systemNote?: string;
  prevHash: string;
  hash: string;
}

export class AuditEvent extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    private props: AuditEventProps,
    createdAt: Date,
  ) {
    super(id, createdAt);
  }

  static record(input: {
    id: string;
    tenantId: string;
    actorId: string;
    eventType: string;
    entityType: string;
    entityId: string;
    projectId?: string;
    oldValue?: string;
    newValue?: string;
    ipAddress?: string;
    systemNote?: string;
    prevHash: string;
    hash: string;
  }): AuditEvent {
    if (!input.eventType) throw DomainError.validation("Event type required");
    if (!input.entityType) throw DomainError.validation("Entity type required");
    return new AuditEvent(input.id, input.tenantId, {
      actorId: input.actorId,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      projectId: input.projectId,
      oldValue: input.oldValue,
      newValue: input.newValue,
      ipAddress: input.ipAddress,
      systemNote: input.systemNote,
      prevHash: input.prevHash,
      hash: input.hash,
    }, new Date());
  }

  get actorId(): string { return this.props.actorId; }
  get eventType(): string { return this.props.eventType; }
  get entityType(): string { return this.props.entityType; }
  get entityId(): string { return this.props.entityId; }
  get projectId(): string | undefined { return this.props.projectId; }
  get oldValue(): string | undefined { return this.props.oldValue; }
  get newValue(): string | undefined { return this.props.newValue; }
  get ipAddress(): string | undefined { return this.props.ipAddress; }
  get systemNote(): string | undefined { return this.props.systemNote; }
  get prevHash(): string { return this.props.prevHash; }
  get hash(): string { return this.props.hash; }
}
