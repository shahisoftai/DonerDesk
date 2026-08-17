import type { Result } from "@donordesk/domain";
import { DomainError, EvidenceFile, EvidenceUploaded } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IEvidenceStorageResolver } from "../../ports/infrastructure.js";
import type { IIdGenerator, IAuditLogger, IEventBus } from "../../ports/core.js";
import type { CreateEvidenceInput } from "@donordesk/contracts";
import type { IUsageCounterRepository } from "../../ports/billing.js";
import type { EntitlementService } from "../../services/entitlement-service.js";
import { entitlementLimitError } from "../../services/entitlement-service.js";
import { monthStartUtc, USAGE_METRIC_STORAGE } from "../billing/_usage.js";

export interface UploadEvidenceCommand extends Omit<CreateEvidenceInput, "storageProvider"> {
  buffer?: Buffer;
  originalFileName: string;
  driveFileId?: string;
  driveWebLink?: string;
  /** Optional; defaults to LOCAL when not supplied by the caller. */
  storageProvider?: import("@donordesk/domain").StorageProvider;
}
export class UploadEvidenceHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly repo: IEvidenceRepository,
    private readonly storageResolver: IEvidenceStorageResolver,
    private readonly events: IEventBus,
    private readonly audit: IAuditLogger,
    private readonly usage: IUsageCounterRepository,
    private readonly entitlements: EntitlementService,
  ) {}

  async handle(ctx: AuthenticatedContext, cmd: UploadEvidenceCommand): Promise<Result<{ id: string; fileUrl: string }, DomainError>> {
    const id = this.ids.generate();
    const tenantId = ctx.tenant.tenantId.toString();
    const now = new Date();
    const storage = await this.storageResolver.resolve(ctx.tenant.tenantId);

    // Managed storage reservation. Bytes that live in DonorDesk-managed storage
    // (LOCAL / R2) consume quota; Google Drive evidence — whether link-first or
    // uploaded into the tenant's own Drive folders — never does.
    const managedBytes =
      storage.provider === "GOOGLE_DRIVE" || cmd.driveWebLink || cmd.driveFileId
        ? 0n
        : BigInt(cmd.fileSize ?? 0);
    if (managedBytes > 0n) {
      const entitlementResult = await this.entitlements.resolve({ tenantId, now });
      if (!entitlementResult.ok) return entitlementResult;
      const limit = entitlementResult.value.limits.maxManagedStorageBytes;
      if (limit !== null) {
        const counter = await this.usage.get(tenantId, USAGE_METRIC_STORAGE, monthStartUtc(now));
        if (!counter.ok) return counter;
        if (counter.value.totalCommitted() + managedBytes > limit) {
          return {
            ok: false,
            error: entitlementLimitError("STORAGE", limit, counter.value.totalCommitted() + managedBytes),
          };
        }
      }
      const reserved = await this.usage.add(tenantId, USAGE_METRIC_STORAGE, monthStartUtc(now), managedBytes);
      if (!reserved.ok) return reserved;
    }

    const location = await storage.save({
      tenantId,
      projectId: cmd.projectId,
      evidenceId: id,
      fileName: cmd.fileName,
      fileType: cmd.fileType,
      fileSize: cmd.fileSize,
      buffer: cmd.buffer,
      driveFileId: cmd.driveFileId,
      driveWebLink: cmd.driveWebLink,
    });
    if (!location.ok) {
      if (managedBytes > 0n) await this.release(ctx, managedBytes);
      return location;
    }

    const ev = EvidenceFile.create({
      id,
      tenantId,
      projectId: cmd.projectId,
      fileName: cmd.fileName,
      title: cmd.title,
      fileUrl: location.value.fileUrl,
      fileType: cmd.fileType,
      fileSize: location.value.fileSize,
      evidenceType: cmd.evidenceType,
      storageProvider: location.value.provider,
      driveFileId: location.value.driveFileId,
      driveWebLink: location.value.driveWebLink,
      storageKey: location.value.storageKey,
      reportingPeriodId: cmd.reportingPeriodId,
      activityId: cmd.activityId,
      indicatorId: cmd.indicatorId,
      location: cmd.location,
      activityDate: cmd.activityDate ? new Date(cmd.activityDate) : undefined,
      uploadedById: ctx.tenant.userId,
      confidentialityLevel: cmd.confidentialityLevel,
      notes: cmd.notes,
    });

    const saved = await this.repo.create(ev);
    if (!saved.ok) {
      await storage.remove(location.value);
      if (managedBytes > 0n) await this.release(ctx, managedBytes);
      return saved;
    }

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "evidence.uploaded",
      entityType: "evidence",
      entityId: id,
      projectId: cmd.projectId,
      newValue: cmd.fileName,
    });

    await this.events.publish([new EvidenceUploaded(ctx.tenant.tenantId, id, cmd.projectId, ctx.tenant.userId)]);

    return { ok: true, value: { id, fileUrl: location.value.fileUrl } };
  }

  private async release(ctx: AuthenticatedContext, bytes: bigint): Promise<void> {
    const counter = await this.usage.add(ctx.tenant.tenantId.toString(), USAGE_METRIC_STORAGE, monthStartUtc(new Date()), -bytes);
    if (!counter.ok) {
      // Reserved counter rows are reconciled by the scheduled job; a failure
      // here must not mask the original error.
      return;
    }
    // Reserved units were incremented, so the negative delta releases them.
    void counter;
  }
}
