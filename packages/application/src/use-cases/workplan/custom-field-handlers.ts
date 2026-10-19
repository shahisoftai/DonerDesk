import { DomainError, checkCustomFieldValue, defineCustomField, err, ok, type CustomFieldDefinition, type Result, type TenantId } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { ICustomFieldValueRepository, IPlanContextReader, IProjectFieldRepository, IPlannedActivityRepository, ProjectFieldRecord } from "../../ports/workplan.js";
import { PlanAccess } from "../../services/plan-access.js";

export const toDefinition = (f: ProjectFieldRecord): CustomFieldDefinition & { id: string } => ({
  id: f.id, key: f.key, label: f.label, type: f.type as CustomFieldDefinition["type"], choices: f.choices,
});

/** Defines a field for a project's planned activities. Managers only; the definition is audited. */
export class DefineProjectFieldHandler {
  constructor(private readonly fields: IProjectFieldRepository, private readonly ids: IIdGenerator, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, projectId: string, input: { label: string; type: CustomFieldDefinition["type"]; choices?: string[] }): Promise<Result<{ id: string }, DomainError>> {
    const allowed = PlanAccess.requireManage(ctx);
    if (!allowed.ok) return allowed;
    const tenantId: TenantId = ctx.tenant.tenantId;
    const existing = await this.fields.findByProject(projectId, tenantId);
    if (!existing.ok) return existing;
    const made = defineCustomField(input, existing.value);
    if (!made.ok) return made;
    const id = this.ids.generate();
    const saved = await this.fields.create({
      id, tenantId: tenantId.toString(), projectId, key: made.value.key, label: made.value.label, type: made.value.type,
      choices: made.value.choices, createdById: ctx.tenant.userId, createdAt: this.clock.now(),
    });
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId, actorId: ctx.tenant.userId, eventType: "workplan.field_defined", entityType: "project_field", entityId: id, projectId,
      newValue: JSON.stringify({ label: made.value.label, type: made.value.type }),
    });
    return ok({ id });
  }
}

export class ListProjectFieldsHandler {
  constructor(private readonly fields: IProjectFieldRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<Array<CustomFieldDefinition & { id: string }>, DomainError>> {
    const found = await this.fields.findByProject(projectId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    return ok(found.value.map(toDefinition));
  }
}

/** The fields of one planned activity: its definitions and the values filled so far. Readable by anyone who can see the plan. */
export class GetPlanItemFieldsHandler {
  constructor(private readonly access: PlanAccess, private readonly fields: IProjectFieldRepository, private readonly values: ICustomFieldValueRepository) {}

  async handle(ctx: AuthenticatedContext, itemId: string): Promise<Result<{ fields: Array<CustomFieldDefinition & { id: string }>; values: Record<string, string> }, DomainError>> {
    const item = await this.access.load(ctx, itemId, "VIEW");
    if (!item.ok) return item;
    const defs = await this.fields.findByProject(item.value.projectId, ctx.tenant.tenantId);
    if (!defs.ok) return defs;
    const values = await this.values.findByEntity(itemId, ctx.tenant.tenantId);
    if (!values.ok) return values;
    return ok({ fields: defs.value.map(toDefinition), values: values.value });
  }
}

/** Fills the fields of one planned activity. The lead or a manager may; every value is checked against its field. */
export class SetPlanItemFieldsHandler {
  constructor(
    private readonly access: PlanAccess, private readonly fields: IProjectFieldRepository, private readonly values: ICustomFieldValueRepository,
    private readonly audit: IAuditLogger, private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, itemId: string, input: { values: Array<{ fieldId: string; value: string | null }> }): Promise<Result<void, DomainError>> {
    const item = await this.access.load(ctx, itemId, "EDIT_NOTES");
    if (!item.ok) return item;
    const defs = await this.fields.findByProject(item.value.projectId, ctx.tenant.tenantId);
    if (!defs.ok) return defs;
    const byId = new Map(defs.value.map((f) => [f.id, toDefinition(f)]));
    const checked: Array<{ fieldId: string; value: string | null }> = [];
    for (const v of input.values) {
      const def = byId.get(v.fieldId);
      if (!def) return err(DomainError.notFound("Field", v.fieldId));
      const value = checkCustomFieldValue(def, v.value);
      if (!value.ok) return value;
      checked.push({ fieldId: v.fieldId, value: value.value });
    }
    if (checked.length === 0) return ok(undefined);
    const saved = await this.values.setValues({
      tenantId: ctx.tenant.tenantId.toString(), projectId: item.value.projectId, entityId: itemId, userId: ctx.tenant.userId, now: this.clock.now(),
    }, checked);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "workplan.fields_set", entityType: "planned_activity", entityId: itemId,
      projectId: item.value.projectId, newValue: JSON.stringify(checked.map((c) => c.fieldId)),
    });
    return ok(undefined);
  }
}

/** A project's fields and every activity's values, in one read, for the plan list and the export. For people on the project or an admin. */
export class ListProjectFieldValuesHandler {
  constructor(private readonly fields: IProjectFieldRepository, private readonly values: ICustomFieldValueRepository, private readonly context: IPlanContextReader) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ fields: Array<CustomFieldDefinition & { id: string }>; values: Record<string, Record<string, string>> }, DomainError>> {
    if (ctx.tenant.role !== "ADMIN") {
      const members = await this.context.activeMemberIds(projectId, ctx.tenant.tenantId);
      if (!members.ok) return members;
      if (!members.value.has(ctx.tenant.userId)) return err(DomainError.forbidden("You are not on this project"));
    }
    const defs = await this.fields.findByProject(projectId, ctx.tenant.tenantId);
    if (!defs.ok) return defs;
    if (defs.value.length === 0) return ok({ fields: [], values: {} });
    const values = await this.values.findByProject(projectId, ctx.tenant.tenantId);
    if (!values.ok) return values;
    return ok({ fields: defs.value.map(toDefinition), values: values.value });
  }
}
