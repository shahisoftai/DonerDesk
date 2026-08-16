import type { IEventBus, IJobQueue, ILogger } from "@donordesk/application";
import { DomainEvent, EvidenceUploaded, ReportingPeriodCreated } from "@donordesk/domain";

/**
 * Maps a domain event type to the async job it should trigger (OCP: add a row
 * to add a mapping; no changes to use-cases). Payloads are derived from the
 * event so the job queue never needs to know about the aggregate internals.
 */
export interface EventToJobMapping {
  eventName: string;
  jobName: string;
  buildPayload: (event: DomainEvent) => Record<string, unknown>;
}

/** Default mappings wired by the container (overridable for tests). */
export const DEFAULT_EVENT_TO_JOB: EventToJobMapping[] = [
  {
    eventName: "evidence.uploaded",
    jobName: "evidence.suggest_tags",
    buildPayload: (event) => ({
      evidenceId: (event as EvidenceUploaded).evidenceId,
      tenantId: (event as EvidenceUploaded).tenantId.toString(),
    }),
  },
  {
    eventName: "project.workspace.provision_requested",
    jobName: "project.workspace.provision",
    buildPayload: (event) => ({
      projectId: (event as unknown as { projectId: string }).projectId,
      tenantId: (event as unknown as { tenantId: import("@donordesk/domain").TenantId }).tenantId.toString(),
    }),
  },
  {
    eventName: "reporting.period.created",
    jobName: "checklist.generate",
    buildPayload: (event) => ({
      reportingPeriodId: (event as ReportingPeriodCreated).reportingPeriodId,
      projectId: (event as ReportingPeriodCreated).projectId,
      tenantId: (event as ReportingPeriodCreated).tenantId.toString(),
    }),
  },
];

/**
 * Outbox-triggering event bus: publishes domain events to the configured job
 * queue (in addition to logging them). This is the seam between the API's
 * domain events and the async orchestrator (Kestra / BullMQ / in-memory).
 */
export class OutboxEventBus implements IEventBus {
  constructor(
    private readonly logger: ILogger,
    private readonly jobs: IJobQueue,
    private readonly mappings: EventToJobMapping[],
  ) {}

  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      this.logger.info("domain.event", { eventName: event.eventName, eventId: event.eventId });
      const mapping = this.mappings.find((m) => m.eventName === event.eventName);
      if (mapping) {
        await this.jobs.enqueue(mapping.jobName, mapping.buildPayload(event));
      }
    }
  }
}
