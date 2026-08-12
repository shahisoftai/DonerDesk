import { randomUUID } from "node:crypto";

export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly occurredAt: Date;
  public abstract readonly eventName: string;

  protected constructor() {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
  }
}
