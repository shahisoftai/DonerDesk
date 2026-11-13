import { TenantId, ok } from "@donordesk/domain";
import type { IAuditLogger, IIndicatorRepository, SetupPlaceRecordingWriter } from "@donordesk/application";

/** Sets "record one figure per place" on the indicators a launch created (Phase 53.6). A calculated indicator is never typed, so it is skipped. */
export class IndicatorPlaceRecordingWriter implements SetupPlaceRecordingWriter {
  constructor(private readonly indicators: IIndicatorRepository, private readonly audit: IAuditLogger) {}

  async recordByPlace(...[ctx, projectId, codes, level]: Parameters<SetupPlaceRecordingWriter["recordByPlace"]>): ReturnType<SetupPlaceRecordingWriter["recordByPlace"]> {
    const tenantId = TenantId.create(ctx.tenant.tenantId.toString());
    const list = await this.indicators.findByProject(projectId, tenantId);
    if (!list.ok) return list;
    const byCode = new Map(list.value.map((i) => [i.code, i] as const));
    let changed = 0;
    const notes: string[] = [];
    for (const code of codes) {
      const indicator = byCode.get(code);
      if (!indicator || indicator.formula || indicator.recordByPlace) continue;
      indicator.update({ recordByPlace: true, placeLevel: level });
      const saved = await this.indicators.update(indicator);
      if (!saved.ok) { notes.push(`${code}: ${saved.error.message}`); continue; }
      changed += 1;
    }
    if (changed > 0) await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "indicator.record_by_place", entityType: "project", entityId: projectId, projectId, newValue: `${changed} indicators recorded by place` });
    return ok({ changed, notes });
  }
}
