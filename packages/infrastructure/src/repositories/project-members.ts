import { PrismaClient } from "@prisma/client";
import {
  ProjectMember,
  TenantId,
  DomainError,
  type Result,
  type Role,
  type ProjectMemberStatus,
} from "@donordesk/domain";
import type { IProjectMemberRepository } from "@donordesk/application";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

type ProjectMemberRow = {
  id: string;
  tenantId: string;
  projectId: string;
  userId: string;
  role: string;
  status: string;
  assignedById: string;
  assignedAt: Date;
  createdAt: Date;
};

export class PrismaProjectMemberRepository implements IProjectMemberRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(member: ProjectMember): Promise<Result<ProjectMember, DomainError>> {
    await this.prisma.projectMember.create({
      data: {
        id: member.id,
        tenantId: member.tenantId.toString(),
        projectId: member.projectId,
        userId: member.userId,
        role: member.role,
        status: member.status,
        assignedById: member.assignedById,
        assignedAt: member.assignedAt,
      },
    });
    return ok(member);
  }

  async update(member: ProjectMember): Promise<Result<ProjectMember, DomainError>> {
    await this.prisma.projectMember.update({
      where: { id: member.id },
      data: {
        role: member.role,
        status: member.status,
      },
    });
    return ok(member);
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<ProjectMember | null, DomainError>> {
    const row = await this.prisma.projectMember.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async findByProject(projectId: string, tenantId: TenantId): Promise<Result<ProjectMember[], DomainError>> {
    const rows = await this.prisma.projectMember.findMany({
      where: { projectId, tenantId: tenantId.toString() },
      orderBy: [{ status: "asc" }, { assignedAt: "asc" }],
    });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  async findByUserAndProject(projectId: string, userId: string, tenantId: TenantId): Promise<Result<ProjectMember | null, DomainError>> {
    const row = await this.prisma.projectMember.findFirst({
      where: { projectId, userId, tenantId: tenantId.toString() },
    });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  private toDomain(row: ProjectMemberRow): ProjectMember {
    return ProjectMember.rehydrate({
      id: row.id,
      tenantId: TenantId.create(row.tenantId),
      createdAt: row.createdAt,
      props: {
        projectId: row.projectId,
        userId: row.userId,
        role: row.role as Role,
        status: row.status as ProjectMemberStatus,
        assignedById: row.assignedById,
        assignedAt: row.assignedAt,
      },
    });
  }
}
