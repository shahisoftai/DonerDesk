/**
 * Prisma implementation of `IAgentMemoryRepository`. Rows are tenant-scoped
 * and RLS-forced (see `infra/postgres/rls.sql`); `tenantId` is additionally
 * filtered in every query here as defense in depth, matching every other
 * tenant repository in this codebase (e.g. `PrismaReportArtifactRepository`).
 */
import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@prisma/client";
import {
  AgentMemory,
  DomainError,
  TenantId,
  type Result,
  type AgentMemoryScope,
  type AgentMemoryCategory,
  type AgentMemoryStatus,
  type AgentMemoryConfidence,
  type AgentMemoryProvenance,
} from "@donordesk/domain";
import type { IAgentMemoryRepository, AgentMemoryCandidate } from "@donordesk/application";

const SCOPE_PRECEDENCE: AgentMemoryScope[] = ["SECTION_TYPE", "TEMPLATE", "DONOR", "ORGANIZATION"];

/** Broadest-scope-first ordering, capped so prompts stay bounded (§6.3). */
export const AGENT_MEMORY_BRIEF_MAX_STATEMENTS = 5;

type AgentMemoryRow = {
  id: string;
  tenantId: string;
  scope: string;
  scopeId: string | null;
  category: string;
  statement: string;
  confidence: string;
  status: string;
  provenanceJson: string;
  approvedById: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function parseProvenance(json: string): AgentMemoryProvenance[] {
  try {
    const raw = JSON.parse(json) as Array<{
      sourceRevisionId?: string;
      parentRevisionId?: string;
      sectionId?: string;
      occurrenceCount?: number;
      lastObservedAt?: string;
    }>;
    if (!Array.isArray(raw)) return [];
    return raw.map((p) => ({
      sourceRevisionId: p.sourceRevisionId ?? "",
      parentRevisionId: p.parentRevisionId ?? "",
      sectionId: p.sectionId ?? "",
      occurrenceCount: p.occurrenceCount ?? 1,
      lastObservedAt: p.lastObservedAt ? new Date(p.lastObservedAt) : new Date(),
    }));
  } catch {
    return [];
  }
}

function toDomain(row: AgentMemoryRow): AgentMemory {
  return AgentMemory.rehydrate({
    id: row.id,
    tenantId: TenantId.create(row.tenantId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    props: {
      scope: row.scope as AgentMemoryScope,
      scopeId: row.scopeId,
      category: row.category as AgentMemoryCategory,
      statement: row.statement,
      confidence: row.confidence as AgentMemoryConfidence,
      status: row.status as AgentMemoryStatus,
      provenance: parseProvenance(row.provenanceJson),
      approvedById: row.approvedById,
      approvedAt: row.approvedAt,
    },
  });
}

function toRow(memory: AgentMemory): Omit<AgentMemoryRow, "createdAt"> {
  return {
    id: memory.id,
    tenantId: memory.tenantId.toString(),
    scope: memory.scope,
    scopeId: memory.scopeId,
    category: memory.category,
    statement: memory.statement,
    confidence: memory.confidence,
    status: memory.status,
    provenanceJson: JSON.stringify(memory.provenance),
    approvedById: memory.approvedById,
    approvedAt: memory.approvedAt,
    updatedAt: memory.updatedAt,
  };
}

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

export class PrismaAgentMemoryRepository implements IAgentMemoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async proposeMany(tenantId: TenantId, candidates: AgentMemoryCandidate[]): Promise<Result<AgentMemory[], DomainError>> {
    try {
      const created: AgentMemory[] = [];
      for (const candidate of candidates) {
        const existing = await this.prisma.agentMemory.findFirst({
          where: {
            tenantId: tenantId.toString(),
            scope: candidate.scope,
            scopeId: candidate.scopeId,
            category: candidate.category,
            statement: candidate.statement,
            status: { in: ["PROPOSED", "ACTIVE"] },
          },
        });
        if (existing) {
          const memory = toDomain(existing as AgentMemoryRow);
          memory.reinforce(candidate.provenance);
          await this.prisma.agentMemory.update({ where: { id: memory.id }, data: toRow(memory) });
          created.push(memory);
          continue;
        }
        const memory = AgentMemory.propose({
          id: randomUUID(),
          tenantId,
          scope: candidate.scope,
          scopeId: candidate.scopeId,
          category: candidate.category,
          statement: candidate.statement,
          provenance: candidate.provenance,
        });
        await this.prisma.agentMemory.create({ data: { ...toRow(memory), createdAt: memory.createdAt } });
        created.push(memory);
      }
      return ok(created);
    } catch (error) {
      return {
        ok: false,
        error: DomainError.invariant(`AgentMemoryRepository.proposeMany failed: ${error instanceof Error ? error.message : String(error)}`),
      };
    }
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<AgentMemory | null, DomainError>> {
    const row = await this.prisma.agentMemory.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? toDomain(row as AgentMemoryRow) : null);
  }

  async findPending(tenantId: TenantId, scope?: AgentMemoryScope): Promise<Result<AgentMemory[], DomainError>> {
    const rows = await this.prisma.agentMemory.findMany({
      where: { tenantId: tenantId.toString(), status: "PROPOSED", ...(scope ? { scope } : {}) },
      orderBy: { updatedAt: "desc" },
    });
    return ok(rows.map((r) => toDomain(r as AgentMemoryRow)));
  }

  async findActive(tenantId: TenantId): Promise<Result<AgentMemory[], DomainError>> {
    const rows = await this.prisma.agentMemory.findMany({
      where: { tenantId: tenantId.toString(), status: "ACTIVE" },
      orderBy: { approvedAt: "desc" },
    });
    return ok(rows.map((r) => toDomain(r as AgentMemoryRow)));
  }

  async findActiveForContext(
    tenantId: TenantId,
    ctx: { donorTemplateId?: string; sectionTitle: string },
  ): Promise<Result<AgentMemory[], DomainError>> {
    const rows = await this.prisma.agentMemory.findMany({
      where: {
        tenantId: tenantId.toString(),
        status: "ACTIVE",
        OR: [
          { scope: "SECTION_TYPE", scopeId: ctx.sectionTitle },
          { scope: "ORGANIZATION" },
          ...(ctx.donorTemplateId ? [{ scope: "DONOR" as const, scopeId: ctx.donorTemplateId }, { scope: "TEMPLATE" as const, scopeId: ctx.donorTemplateId }] : []),
        ],
      },
    });
    const memories = rows.map((r) => toDomain(r as AgentMemoryRow));
    memories.sort((a, b) => SCOPE_PRECEDENCE.indexOf(a.scope) - SCOPE_PRECEDENCE.indexOf(b.scope));
    return ok(memories.slice(0, AGENT_MEMORY_BRIEF_MAX_STATEMENTS));
  }

  async update(memory: AgentMemory): Promise<Result<AgentMemory, DomainError>> {
    try {
      await this.prisma.agentMemory.update({ where: { id: memory.id }, data: toRow(memory) });
      return ok(memory);
    } catch (error) {
      return {
        ok: false,
        error: DomainError.invariant(`AgentMemoryRepository.update failed: ${error instanceof Error ? error.message : String(error)}`),
      };
    }
  }
}
