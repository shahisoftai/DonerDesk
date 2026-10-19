import type { ICustomFieldValueRepository, IProjectFieldRepository, ProjectFieldRecord } from "@donordesk/application";
import { DomainError, ok } from "@donordesk/domain";
import type { Result, TenantId } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";

/** Custom fields a project defines (phase 28.1-C). A repeated key is a conflict. */
export class PrismaProjectFieldRepository implements IProjectFieldRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(f: ProjectFieldRecord): Promise<Result<void, DomainError>> {
    try {
      await this.prisma.projectField.create({
        data: { id: f.id, tenantId: f.tenantId, projectId: f.projectId, key: f.key, label: f.label, type: f.type, choicesJson: JSON.stringify(f.choices), createdById: f.createdById, createdAt: f.createdAt },
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return { ok: false, error: DomainError.conflict("A field with this name already exists") };
      throw e;
    }
    return ok(undefined);
  }

  async findByProject(projectId: string, tenantId: TenantId): Promise<Result<ProjectFieldRecord[], DomainError>> {
    const rows = await this.prisma.projectField.findMany({ where: { tenantId: tenantId.toString(), projectId }, orderBy: { createdAt: "asc" } });
    return ok(rows.map((r) => ({ id: r.id, tenantId: r.tenantId, projectId: r.projectId, key: r.key, label: r.label, type: r.type, choices: JSON.parse(r.choicesJson) as string[], createdById: r.createdById, createdAt: r.createdAt })));
  }
}

/** Values on planned activities. A blank value removes the row, so blank stays blank. */
export class PrismaCustomFieldValueRepository implements ICustomFieldValueRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async setValues(
    entity: { tenantId: string; projectId: string; entityId: string; userId: string; now: Date },
    values: ReadonlyArray<{ fieldId: string; value: string | null }>,
  ): Promise<Result<void, DomainError>> {
    await this.prisma.$transaction(values.map((v) => (v.value === null
      ? this.prisma.customFieldValue.deleteMany({ where: { fieldId: v.fieldId, entityId: entity.entityId } })
      : this.prisma.customFieldValue.upsert({
        where: { fieldId_entityId: { fieldId: v.fieldId, entityId: entity.entityId } },
        create: { id: `${v.fieldId}:${entity.entityId}`, tenantId: entity.tenantId, projectId: entity.projectId, fieldId: v.fieldId, entityId: entity.entityId, value: v.value, updatedById: entity.userId, updatedAt: entity.now },
        update: { value: v.value, updatedById: entity.userId, updatedAt: entity.now },
      }))));
    return ok(undefined);
  }

  async findByProject(projectId: string, tenantId: TenantId): Promise<Result<Record<string, Record<string, string>>, DomainError>> {
    const rows = await this.prisma.customFieldValue.findMany({ where: { tenantId: tenantId.toString(), projectId } });
    const out: Record<string, Record<string, string>> = {};
    for (const r of rows) (out[r.entityId] ??= {})[r.fieldId] = r.value;
    return ok(out);
  }

  async findByEntity(entityId: string, tenantId: TenantId): Promise<Result<Record<string, string>, DomainError>> {
    const rows = await this.prisma.customFieldValue.findMany({ where: { tenantId: tenantId.toString(), entityId } });
    return ok(Object.fromEntries(rows.map((r) => [r.fieldId, r.value])));
  }
}
