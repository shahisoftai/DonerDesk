import { TenantId, ok, parseLink, semanticsFromSnapshot } from "@donordesk/domain";
import type { IAuditLogger, IIndicatorRepository, SetupLibraryLinkWriter } from "@donordesk/application";

/** Writes the library link onto indicators the wizard created, found by their code. An indicator already linked, or without a code match, is left as it is and named. */
export class IndicatorLibraryLinkWriter implements SetupLibraryLinkWriter {
  constructor(private readonly indicators: IIndicatorRepository, private readonly audit: IAuditLogger) {}

  async link(...[ctx, projectId, items]: Parameters<SetupLibraryLinkWriter["link"]>): ReturnType<SetupLibraryLinkWriter["link"]> {
    const tenantId = TenantId.create(ctx.tenant.tenantId.toString());
    const list = await this.indicators.findByProject(projectId, tenantId);
    if (!list.ok) return list;
    const byCode = new Map(list.value.map((i) => [i.code, i] as const));
    let linked = 0;
    const notes: string[] = [];
    for (const item of items) {
      const indicator = byCode.get(item.code);
      if (!indicator) { notes.push(`${item.code}: the indicator was not found in the project, so it was not linked to the library.`); continue; }
      if (indicator.libraryId) continue;
      const link = parseLink(item.linkJson);
      indicator.update({
        libraryId: item.libraryId, libraryVersion: item.libraryVersion, libraryJson: item.linkJson,
        ...(!indicator.semanticsJson && link ? { semanticsJson: JSON.stringify(semanticsFromSnapshot(link.snapshot)) } : {}),
      });
      const saved = await this.indicators.update(indicator);
      if (!saved.ok) { notes.push(`${item.code}: ${saved.error.message}`); continue; }
      linked += 1;
    }
    if (linked > 0) await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "sector_library.linked", entityType: "project", entityId: projectId, projectId, newValue: `${linked} indicators linked to the sector library` });
    return ok({ linked, notes });
  }
}
