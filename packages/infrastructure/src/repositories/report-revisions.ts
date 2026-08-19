import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  ReportRevision,
  SubmissionSnapshot,
  DomainError,
  type Result,
  type ReportingRequirementPack,
  type AwardReportingOverride,
  type ResolvedReportingRequirements,
  type RequirementSourceReference,
  type SubmissionSnapshotProps,
  type ApprovalRecord,
  type AssertionManifestEntry,
  type EvidenceManifestEntry,
  type AnnexManifestEntry,
  type AuthorizedOverride,
  type ArtifactHashEntry,
} from "@donordesk/domain";
import type {
  IReportRevisionRepository,
  ISubmissionSnapshotRepository,
  IRequirementPackRepository,
  IAwardOverrideRepository,
  IResolvedRequirementsRepository,
} from "@donordesk/application";
import type { TenantId } from "@donordesk/domain";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

export class PrismaReportRevisionRepository implements IReportRevisionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(r: ReportRevision): Promise<Result<ReportRevision, DomainError>> {
    await this.prisma.reportRevision.create({
      data: {
        id: r.id,
        tenantId: r.tenantIdValue,
        draftId: r.draftId,
        sectionId: r.sectionId,
        revisionNumber: r.revisionNumber,
        parentRevisionId: r.parentRevisionId,
        content: r.content,
        contentHash: r.contentHash,
        changeOrigin: r.changeOrigin,
        actorId: r.actorId,
        modelId: r.modelId,
        promptVersion: r.promptVersion,
        generationRunId: r.generationRunId,
        assuranceState: r.assuranceState,
      },
    });
    return ok(r);
  }

  async update(r: ReportRevision): Promise<Result<ReportRevision, DomainError>> {
    await this.prisma.reportRevision.update({
      where: { id: r.id },
      data: { assuranceState: r.assuranceState },
    });
    return ok(r);
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<ReportRevision | null, DomainError>> {
    const row = await this.prisma.reportRevision.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async findBySection(sectionId: string, tenantId: TenantId): Promise<Result<ReportRevision[], DomainError>> {
    const rows = await this.prisma.reportRevision.findMany({
      where: { sectionId, tenantId: tenantId.toString() },
      orderBy: { revisionNumber: "asc" },
    });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  async findByDraft(draftId: string, tenantId: TenantId): Promise<Result<ReportRevision[], DomainError>> {
    const rows = await this.prisma.reportRevision.findMany({
      where: { draftId, tenantId: tenantId.toString() },
      orderBy: { revisionNumber: "asc" },
    });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  async findCurrentForSection(sectionId: string, tenantId: TenantId): Promise<Result<ReportRevision | null, DomainError>> {
    const row = await this.prisma.reportRevision.findFirst({
      where: { sectionId, tenantId: tenantId.toString() },
      orderBy: { revisionNumber: "desc" },
    });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async deleteBySection(sectionId: string, tenantId: TenantId): Promise<Result<void, DomainError>> {
    await this.prisma.reportRevision.deleteMany({ where: { sectionId, tenantId: tenantId.toString() } });
    return ok(undefined);
  }

  async createNextForSection(input: {
    tenantId: TenantId;
    sectionId: string;
    draftId: string;
    content: string;
    contentHash: string;
    changeOrigin: ReportRevision["changeOrigin"];
    actorId: string;
    modelId?: string;
    promptVersion?: number;
    generationRunId?: string;
  }): Promise<Result<ReportRevision, DomainError>> {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const max = await this.prisma.reportRevision.aggregate({
          where: { tenantId: input.tenantId.toString(), sectionId: input.sectionId },
          _max: { revisionNumber: true },
        });
        const revisionNumber = (max._max.revisionNumber ?? 0) + 1;
        const previous = await this.prisma.reportRevision.findFirst({
          where: { tenantId: input.tenantId.toString(), sectionId: input.sectionId, revisionNumber: revisionNumber - 1 },
          select: { id: true },
        });
        const revision = ReportRevision.create({
          id: randomUUID(),
          tenantId: input.tenantId.toString(),
          draftId: input.draftId,
          sectionId: input.sectionId,
          revisionNumber,
          parentRevisionId: previous?.id,
          content: input.content,
          contentHash: input.contentHash,
          changeOrigin: input.changeOrigin,
          actorId: input.actorId,
          modelId: input.modelId,
          promptVersion: input.promptVersion,
          generationRunId: input.generationRunId,
        });
        await this.prisma.reportRevision.create({
          data: {
            id: revision.id,
            tenantId: revision.tenantIdValue,
            draftId: revision.draftId,
            sectionId: revision.sectionId,
            revisionNumber: revision.revisionNumber,
            parentRevisionId: revision.parentRevisionId,
            content: revision.content,
            contentHash: revision.contentHash,
            changeOrigin: revision.changeOrigin,
            actorId: revision.actorId,
            modelId: revision.modelId,
            promptVersion: revision.promptVersion,
            generationRunId: revision.generationRunId,
            assuranceState: revision.assuranceState,
          },
        });
        return ok(revision);
      } catch (error) {
        const e = error as { code?: string };
        if (e?.code === "P2002") continue;
        return { ok: false, error: new DomainError("CONFLICT", String(error)) };
      }
    }
    return { ok: false, error: new DomainError("CONFLICT", "Could not allocate a unique report revision number") };
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    draftId: string;
    sectionId: string;
    revisionNumber: number;
    parentRevisionId: string | null;
    content: string;
    contentHash: string;
    changeOrigin: string;
    actorId: string;
    modelId: string | null;
    promptVersion: number | null;
    generationRunId: string | null;
    assuranceState: string;
    createdAt: Date;
    updatedAt: Date;
  }): ReportRevision {
    return ReportRevision.rehydrate({
      id: row.id,
      tenantId: row.tenantId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      props: {
        draftId: row.draftId,
        sectionId: row.sectionId,
        revisionNumber: row.revisionNumber,
        parentRevisionId: row.parentRevisionId ?? undefined,
        content: row.content,
        contentHash: row.contentHash,
        changeOrigin: row.changeOrigin as ReportRevision["changeOrigin"],
        actorId: row.actorId,
        modelId: row.modelId ?? undefined,
        promptVersion: row.promptVersion ?? undefined,
        generationRunId: row.generationRunId ?? undefined,
        assuranceState: row.assuranceState as ReportRevision["assuranceState"],
      },
    });
  }
}

export class PrismaSubmissionSnapshotRepository implements ISubmissionSnapshotRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(s: SubmissionSnapshot): Promise<Result<SubmissionSnapshot, DomainError>> {
    await this.prisma.submissionSnapshot.create({
      data: {
        id: s.id,
        tenantId: s.tenantIdValue,
        projectId: s.projectId,
        reportDraftId: s.reportDraftId,
        reportingPeriodId: s.reportingPeriodId,
        status: s.status,
        propsJson: JSON.stringify(serializeSnapshotProps(s)),
      },
    });
    return ok(s);
  }

  async update(s: SubmissionSnapshot): Promise<Result<SubmissionSnapshot, DomainError>> {
    await this.prisma.submissionSnapshot.update({
      where: { id: s.id },
      data: { status: s.status, propsJson: JSON.stringify(serializeSnapshotProps(s)) },
    });
    return ok(s);
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<SubmissionSnapshot | null, DomainError>> {
    const row = await this.prisma.submissionSnapshot.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async findLatestForDraft(draftId: string, tenantId: TenantId): Promise<Result<SubmissionSnapshot | null, DomainError>> {
    const row = await this.prisma.submissionSnapshot.findFirst({
      where: { reportDraftId: draftId, tenantId: tenantId.toString() },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    projectId: string;
    reportDraftId: string;
    reportingPeriodId: string;
    status: string;
    propsJson: string;
    createdAt: Date;
    sealedAt: Date;
  }): SubmissionSnapshot {
    return SubmissionSnapshot.rehydrate({
      id: row.id,
      tenantId: row.tenantId,
      projectId: row.projectId,
      createdAt: row.createdAt,
      sealedAt: row.sealedAt,
      props: deserializeSnapshotProps(row.propsJson),
    });
  }
}

function serializeSnapshotProps(s: SubmissionSnapshot): Record<string, unknown> {
  const approvalRecords = s.approvalRecords.map((a) => ({ ...a, approvedAt: a.approvedAt.toISOString() }));
  return {
    reportDraftId: s.reportDraftId,
    reportingPeriodId: s.reportingPeriodId,
    approvedRevisionIds: s.approvedRevisionIds,
    revisionHashes: s.revisionHashes,
    requirementSnapshotId: s.requirementSnapshotId,
    requirementCoverage: s.requirementCoverage,
    assertionManifest: s.assertionManifest,
    evidenceManifest: s.evidenceManifest,
    annexManifest: s.annexManifest,
    templateMappingId: s.templateMappingId,
    templateMappingVersion: s.templateMappingVersion,
    approvalRecords,
    overrides: s.overrides,
    rendererVersion: s.rendererVersion,
    artifactHashes: s.artifactHashes,
    status: s.status,
  };
}

function deserializeSnapshotProps(json: string): SubmissionSnapshotProps {
  const raw = JSON.parse(json) as Record<string, unknown>;
  return {
    reportDraftId: String(raw.reportDraftId),
    reportingPeriodId: String(raw.reportingPeriodId),
    approvedRevisionIds: (raw.approvedRevisionIds as string[]) ?? [],
    revisionHashes: (raw.revisionHashes as Record<string, string>) ?? {},
    requirementSnapshotId: String(raw.requirementSnapshotId),
    requirementCoverage: (raw.requirementCoverage as { satisfied: string[]; unmet: string[] }) ?? { satisfied: [], unmet: [] },
    assertionManifest: (raw.assertionManifest as AssertionManifestEntry[]) ?? [],
    evidenceManifest: (raw.evidenceManifest as EvidenceManifestEntry[]) ?? [],
    annexManifest: (raw.annexManifest as AnnexManifestEntry[]) ?? [],
    templateMappingId: (raw.templateMappingId as string | undefined) ?? undefined,
    templateMappingVersion: (raw.templateMappingVersion as number | undefined) ?? undefined,
    approvalRecords: ((raw.approvalRecords as Array<Omit<ApprovalRecord, "approvedAt"> & { approvedAt: string }>) ?? []).map((a) => ({
      ...a,
      approvedAt: new Date(a.approvedAt),
    })),
    overrides: (raw.overrides as AuthorizedOverride[]) ?? [],
    rendererVersion: (raw.rendererVersion as string | undefined) ?? undefined,
    artifactHashes: (raw.artifactHashes as ArtifactHashEntry[]) ?? [],
    status: (raw.status as SubmissionSnapshot["status"]) ?? "SEALED",
  };
}

export class PrismaRequirementPackRepository implements IRequirementPackRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(pack: ReportingRequirementPack): Promise<Result<ReportingRequirementPack, DomainError>> {
    await this.prisma.reportingRequirementPack.create({
      data: {
        id: pack.id,
        tenantId: pack.tenantId,
        donorKey: pack.donorKey,
        mechanismKey: pack.mechanismKey,
        reportType: pack.reportType,
        version: pack.version,
        language: pack.language,
        name: pack.name,
        status: pack.status,
        requirementsJson: JSON.stringify(pack.requirements),
      },
    });
    return ok(pack);
  }

  async update(pack: ReportingRequirementPack): Promise<Result<ReportingRequirementPack, DomainError>> {
    await this.prisma.reportingRequirementPack.update({
      where: { id: pack.id },
      data: {
        status: pack.status,
        requirementsJson: JSON.stringify(pack.requirements),
        version: pack.version,
        name: pack.name,
      },
    });
    return ok(pack);
  }

  async findById(id: string, tenantId: string | undefined): Promise<Result<ReportingRequirementPack | null, DomainError>> {
    const row = await this.prisma.reportingRequirementPack.findFirst({
      where: tenantId ? { id, tenantId } : { id, tenantId: null },
    });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async findActiveByMechanism(input: {
    donorKey: string;
    mechanismKey: string;
    reportType: string;
    language: string;
    tenantId?: string;
  }): Promise<Result<ReportingRequirementPack | null, DomainError>> {
    const row = await this.prisma.reportingRequirementPack.findFirst({
      where: {
        donorKey: input.donorKey,
        mechanismKey: input.mechanismKey,
        reportType: input.reportType,
        language: input.language,
        status: "ACTIVE",
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      },
      orderBy: { version: "desc" },
    });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  private toDomain(row: {
    id: string;
    tenantId: string | null;
    donorKey: string;
    mechanismKey: string;
    reportType: string;
    version: number;
    language: string;
    name: string;
    status: string;
    requirementsJson: string;
    createdAt: Date;
    updatedAt: Date;
  }): ReportingRequirementPack {
    return {
      id: row.id,
      tenantId: row.tenantId ?? undefined,
      donorKey: row.donorKey,
      mechanismKey: row.mechanismKey,
      reportType: row.reportType,
      version: row.version,
      language: row.language,
      name: row.name,
      status: row.status as ReportingRequirementPack["status"],
      requirements: JSON.parse(row.requirementsJson) as ReportingRequirementPack["requirements"],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export class PrismaAwardOverrideRepository implements IAwardOverrideRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(o: AwardReportingOverride): Promise<Result<AwardReportingOverride, DomainError>> {
    await this.prisma.awardReportingOverride.create({
      data: {
        id: o.id,
        tenantId: o.tenantId,
        projectId: o.projectId,
        awardId: o.awardId,
        effectiveFrom: new Date(o.effectiveFrom),
        effectiveTo: o.effectiveTo ? new Date(o.effectiveTo) : null,
        documentHash: o.documentHash,
        version: o.version,
        status: o.status,
        requirementsJson: JSON.stringify(o.requirements),
        sourceReferenceJson: JSON.stringify(o.sourceReference),
      },
    });
    return ok(o);
  }

  async update(o: AwardReportingOverride): Promise<Result<AwardReportingOverride, DomainError>> {
    await this.prisma.awardReportingOverride.update({
      where: { id: o.id },
      data: {
        effectiveFrom: new Date(o.effectiveFrom),
        effectiveTo: o.effectiveTo ? new Date(o.effectiveTo) : null,
        documentHash: o.documentHash,
        version: o.version,
        status: o.status,
        requirementsJson: JSON.stringify(o.requirements),
        sourceReferenceJson: JSON.stringify(o.sourceReference),
      },
    });
    return ok(o);
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<AwardReportingOverride | null, DomainError>> {
    const row = await this.prisma.awardReportingOverride.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async findActiveForProject(projectId: string, tenantId: TenantId, effectiveDate: Date): Promise<Result<AwardReportingOverride[], DomainError>> {
    const rows = await this.prisma.awardReportingOverride.findMany({
      where: {
        projectId,
        tenantId: tenantId.toString(),
        status: "ACTIVE",
        effectiveFrom: { lte: effectiveDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveDate } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    projectId: string;
    awardId: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    documentHash: string | null;
    version: number;
    status: string;
    requirementsJson: string;
    sourceReferenceJson: string;
    createdAt: Date;
    updatedAt: Date;
  }): AwardReportingOverride {
    return {
      id: row.id,
      tenantId: row.tenantId,
      projectId: row.projectId,
      awardId: row.awardId,
      effectiveFrom: row.effectiveFrom.toISOString(),
      effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString() : undefined,
      documentHash: row.documentHash ?? undefined,
      version: row.version,
      status: row.status as AwardReportingOverride["status"],
      requirements: JSON.parse(row.requirementsJson) as AwardReportingOverride["requirements"],
      sourceReference: JSON.parse(row.sourceReferenceJson) as RequirementSourceReference,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export class PrismaResolvedRequirementsRepository implements IResolvedRequirementsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(r: ResolvedReportingRequirements): Promise<Result<ResolvedReportingRequirements, DomainError>> {
    await this.prisma.resolvedReportingRequirements.create({
      data: {
        id: r.id,
        tenantId: r.tenantId,
        reportingPeriodId: r.reportingPeriodId,
        generationRunId: r.generationRunId,
        snapshotJson: JSON.stringify(r.snapshot),
        sourceTraceJson: JSON.stringify(r.sourceTrace),
        coverageJson: JSON.stringify(r.coverage),
        resolvedAt: r.resolvedAt,
      },
    });
    return ok(r);
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<ResolvedReportingRequirements | null, DomainError>> {
    const row = await this.prisma.resolvedReportingRequirements.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async findLatestForPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<ResolvedReportingRequirements | null, DomainError>> {
    const row = await this.prisma.resolvedReportingRequirements.findFirst({
      where: { reportingPeriodId, tenantId: tenantId.toString() },
      orderBy: { resolvedAt: "desc" },
    });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    reportingPeriodId: string;
    generationRunId: string | null;
    snapshotJson: string;
    sourceTraceJson: string;
    coverageJson: string;
    resolvedAt: Date;
    createdAt: Date;
  }): ResolvedReportingRequirements {
    return {
      id: row.id,
      tenantId: row.tenantId,
      reportingPeriodId: row.reportingPeriodId,
      generationRunId: row.generationRunId ?? undefined,
      snapshot: JSON.parse(row.snapshotJson) as ResolvedReportingRequirements["snapshot"],
      sourceTrace: JSON.parse(row.sourceTraceJson) as ResolvedReportingRequirements["sourceTrace"],
      coverage: JSON.parse(row.coverageJson) as ResolvedReportingRequirements["coverage"],
      resolvedAt: row.resolvedAt,
      createdAt: row.createdAt,
    };
  }
}
