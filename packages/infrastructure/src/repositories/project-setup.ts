import type { PrismaClient } from "@prisma/client";
import { TenantId, DomainError, ok, err, type ProjectSetupProposal, type Result, type SetupExtras, type SetupAreaKey, type SetupProblem } from "@donordesk/domain";
import type {
  IPendingMemberRepository, ISetupProposalRepository, ISetupRunRepository, PendingMember, StoredSetupProposal, StoredSetupRun, SetupProposalStatus,
} from "@donordesk/application";

type ProposalRow = Awaited<ReturnType<PrismaClient["projectSetupProposal"]["findUnique"]>> & { updatedAt: Date };

/** A proposal made before the wizard has no decisions: `{}` reads as absent, never as a half-empty object. */
const parseExtras = (json: string): SetupExtras | undefined => {
  const parsed = JSON.parse(json) as Partial<SetupExtras>;
  return parsed && typeof parsed === "object" && "start" in parsed ? (parsed as SetupExtras) : undefined;
};

const fromRow = (r: NonNullable<ProposalRow>): StoredSetupProposal => ({
  id: r.id,
  tenantId: TenantId.create(r.tenantId),
  createdById: r.createdById,
  status: r.status as SetupProposalStatus,
  sourceName: r.sourceName,
  sourceStorageKey: r.sourceStorageKey,
  sourceHash: r.sourceHash,
  sourceLength: r.sourceLength,
  proposal: JSON.parse(r.proposalJson) as ProjectSetupProposal,
  problems: JSON.parse(r.problemsJson) as SetupProblem[],
  extras: parseExtras(r.extrasJson),
  appliedProjectId: r.appliedProjectId ?? undefined,
  promptVersion: r.promptVersion ?? undefined,
  model: r.model ?? undefined,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  expiresAt: r.expiresAt,
});

/** One repository per aggregate: the proposal. Every mutable field is written on update (`?? null` for clearables). */
export class PrismaSetupProposalRepository implements ISetupProposalRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(p: StoredSetupProposal): Promise<Result<void>> {
    try {
      await this.prisma.projectSetupProposal.create({
        data: {
          id: p.id,
          tenantId: p.tenantId.toString(),
          createdById: p.createdById,
          status: p.status,
          sourceName: p.sourceName,
          sourceStorageKey: p.sourceStorageKey,
          sourceHash: p.sourceHash,
          sourceLength: p.sourceLength,
          proposalJson: JSON.stringify(p.proposal),
          problemsJson: JSON.stringify(p.problems),
          extrasJson: JSON.stringify(p.extras ?? {}),
          appliedProjectId: p.appliedProjectId ?? null,
          // The proposal's own timestamps: the version the handler hands out is the one stored.
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          promptVersion: p.promptVersion ?? null,
          model: p.model ?? null,
          expiresAt: p.expiresAt,
        },
      });
      return ok(undefined);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async update(p: StoredSetupProposal, expectedUpdatedAt?: Date): Promise<Result<boolean>> {
    try {
      const done = await this.prisma.projectSetupProposal.updateMany({
        where: { id: p.id, tenantId: p.tenantId.toString(), ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}) },
        data: {
          status: p.status,
          proposalJson: JSON.stringify(p.proposal),
          problemsJson: JSON.stringify(p.problems),
          appliedProjectId: p.appliedProjectId ?? null,
          promptVersion: p.promptVersion ?? null,
          model: p.model ?? null,
        },
      });
      return ok(done.count > 0);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async updateExtras(id: string, tenantId: TenantId, extras: SetupExtras, expectedUpdatedAt: Date): Promise<Result<boolean>> {
    try {
      const done = await this.prisma.projectSetupProposal.updateMany({
        where: { id, tenantId: tenantId.toString(), updatedAt: expectedUpdatedAt },
        data: { extrasJson: JSON.stringify(extras) },
      });
      return ok(done.count > 0);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<StoredSetupProposal | null>> {
    try {
      const row = await this.prisma.projectSetupProposal.findFirst({ where: { id, tenantId: tenantId.toString() } });
      return ok(row ? fromRow(row as NonNullable<ProposalRow>) : null);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async listForCreator(tenantId: TenantId, createdById: string): Promise<Result<StoredSetupProposal[]>> {
    try {
      const rows = await this.prisma.projectSetupProposal.findMany({
        where: { tenantId: tenantId.toString(), createdById },
        orderBy: { createdAt: "desc" },
      });
      return ok(rows.map((r) => fromRow(r as NonNullable<ProposalRow>)));
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async countStartedSince(tenantId: TenantId, since: Date): Promise<Result<number>> {
    try {
      const n = await this.prisma.projectSetupProposal.count({
        // Only setups that read documents count towards the daily cap on reading: a draft started with no documents costs nothing.
        where: { tenantId: tenantId.toString(), createdAt: { gte: since }, sourceLength: { gt: 0 } },
      });
      return ok(n);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async delete(id: string, tenantId: TenantId): Promise<Result<void>> {
    try {
      await this.prisma.projectSetupProposal.deleteMany({ where: { id, tenantId: tenantId.toString() } });
      return ok(undefined);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }
}

type RunRow = Awaited<ReturnType<PrismaClient["projectSetupRun"]["findUnique"]>> & { startedAt: Date };

const runFrom = (r: NonNullable<RunRow>): StoredSetupRun => ({
  id: r.id,
  tenantId: TenantId.create(r.tenantId),
  proposalId: r.proposalId,
  kind: r.kind as StoredSetupRun["kind"],
  area: (r.area ?? undefined) as SetupAreaKey | undefined,
  status: r.status as StoredSetupRun["status"],
  detail: JSON.parse(r.detailJson) as Record<string, string | number | boolean>,
  startedAt: r.startedAt,
  finishedAt: r.finishedAt ?? undefined,
});

/** The run rows: what ran, when, and the counts it saw — never document text. */
export class PrismaSetupRunRepository implements ISetupRunRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async start(r: StoredSetupRun): Promise<Result<void>> {
    try {
      await this.prisma.projectSetupRun.create({
        data: {
          id: r.id, tenantId: r.tenantId.toString(), proposalId: r.proposalId,
          kind: r.kind, area: r.area ?? null, status: r.status,
          detailJson: JSON.stringify(r.detail), startedAt: r.startedAt,
        },
      });
      return ok(undefined);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async progress(id: string, tenantId: TenantId, detail: Record<string, string | number | boolean>): Promise<Result<void>> {
    try {
      await this.prisma.projectSetupRun.updateMany({
        where: { id, tenantId: tenantId.toString(), status: "RUNNING" },
        data: { detailJson: JSON.stringify(detail) },
      });
      return ok(undefined);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async finish(id: string, tenantId: TenantId, detail: Record<string, string | number | boolean>, at: Date): Promise<Result<void>> {
    try {
      await this.prisma.projectSetupRun.updateMany({
        where: { id, tenantId: tenantId.toString() },
        data: { status: "FINISHED", detailJson: JSON.stringify(detail), finishedAt: at },
      });
      return ok(undefined);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async fail(id: string, tenantId: TenantId, detail: Record<string, string | number | boolean>, at: Date): Promise<Result<void>> {
    try {
      await this.prisma.projectSetupRun.updateMany({
        where: { id, tenantId: tenantId.toString() },
        data: { status: "FAILED", detailJson: JSON.stringify(detail), finishedAt: at },
      });
      return ok(undefined);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async find(id: string, tenantId: TenantId): Promise<Result<StoredSetupRun | null>> {
    try {
      const row = await this.prisma.projectSetupRun.findFirst({ where: { id, tenantId: tenantId.toString() } });
      return ok(row ? runFrom(row as NonNullable<RunRow>) : null);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async listByProposal(proposalId: string, tenantId: TenantId): Promise<Result<StoredSetupRun[]>> {
    try {
      const rows = await this.prisma.projectSetupRun.findMany({
        where: { proposalId, tenantId: tenantId.toString() },
        orderBy: { startedAt: "asc" },
      });
      return ok(rows.map((r) => runFrom(r as NonNullable<RunRow>)));
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async deleteByProposal(proposalId: string, tenantId: TenantId): Promise<Result<void>> {
    try {
      await this.prisma.projectSetupRun.deleteMany({ where: { proposalId, tenantId: tenantId.toString() } });
      return ok(undefined);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }
}

/** The people named in a project setup who have not joined yet. One row per project and email. */
export class PrismaPendingMemberRepository implements IPendingMemberRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(m: PendingMember): Promise<Result<void>> {
    try {
      await this.prisma.projectPendingMember.create({ data: { id: m.id, tenantId: m.tenantId, projectId: m.projectId, email: m.email, name: m.name, role: m.role, createdById: m.createdById, responsibilitiesJson: m.responsibilitiesJson, createdAt: m.createdAt } });
      return ok(undefined);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async find(tenantId: string, projectId: string, email: string): Promise<Result<PendingMember | null>> {
    try {
      const row = await this.prisma.projectPendingMember.findFirst({ where: { tenantId, projectId, email } });
      return ok(row ?? null);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async listByEmail(tenantId: string, email: string): Promise<Result<PendingMember[]>> {
    try {
      return ok(await this.prisma.projectPendingMember.findMany({ where: { tenantId, email }, orderBy: { createdAt: "asc" } }));
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async delete(id: string, tenantId: string): Promise<Result<void>> {
    try {
      await this.prisma.projectPendingMember.deleteMany({ where: { id, tenantId } });
      return ok(undefined);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }
}
