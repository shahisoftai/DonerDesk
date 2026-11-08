import type { Result } from "@donordesk/domain";
import { DomainError, diffVersions, linkOf, parseLink, semanticsOf } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";
import type { EffectiveLibraryService } from "../../services/effective-library.js";

/** The fields of a project's indicator a library change may carry over. A person picks which; the rest stay theirs. */
export const APPLYABLE_FIELDS = ["name", "unit", "frequency", "meansOfVerification", "direction", "aggregation"] as const;
export type ApplyableField = (typeof APPLYABLE_FIELDS)[number];
export interface ApplyUpdateInput { indicatorId: string; /** Fields to carry over. Empty: only note that the change was seen. */ fields: readonly ApplyableField[] }

/**
 * Applies chosen differences from the library to a project's indicator, then remembers the library's current version so the
 * difference is not offered again. A field not chosen is left as the person has it.
 */
export class ApplyLibraryUpdateHandler {
  constructor(private readonly library: EffectiveLibraryService, private readonly indicators: IIndicatorRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, input: ApplyUpdateInput): Promise<Result<{ applied: ApplyableField[] }, DomainError>> {
    const found = await this.indicators.findById(input.indicatorId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const indicator = found.value;
    const link = indicator ? parseLink(indicator.libraryJson) : null;
    if (!indicator || !link || !indicator.libraryId) return { ok: false, error: DomainError.validation("This indicator was not copied from the library.") };
    const lib = await this.library.forTenant(ctx.tenant.tenantId);
    if (!lib.ok) return lib;
    const entry = lib.value.byId.get(indicator.libraryId);
    const state = diffVersions(link, entry, (id) => lib.value.byId.get(id));
    if (!entry || state.state === "REMOVED") return { ok: false, error: DomainError.validation("This entry is no longer in the library.") };
    const patch: Record<string, unknown> = {};
    const applied: ApplyableField[] = [];
    const sem = indicator.semantics ?? semanticsOf(entry);
    for (const f of new Set(input.fields)) {
      if (f === "name") patch.name = entry.name.slice(0, 300);
      else if (f === "unit") patch.unit = entry.unit.slice(0, 50);
      else if (f === "frequency") patch.frequency = entry.frequency.slice(0, 50);
      else if (f === "meansOfVerification") patch.meansOfVerification = entry.meansOfVerification.join("; ").slice(0, 500);
      else if (f === "direction") patch.semanticsJson = JSON.stringify({ ...sem, ...(patch.semanticsJson ? JSON.parse(patch.semanticsJson as string) : {}), direction: semanticsOf(entry).direction, status: "REQUIRES_REVIEW" });
      else if (f === "aggregation") patch.semanticsJson = JSON.stringify({ ...sem, ...(patch.semanticsJson ? JSON.parse(patch.semanticsJson as string) : {}), aggregation: entry.aggregation, status: "REQUIRES_REVIEW" });
      else continue;
      applied.push(f);
    }
    indicator.update({ ...patch, libraryVersion: entry.version, libraryJson: JSON.stringify(linkOf(entry, this.clock.now().toISOString().slice(0, 10))) });
    const saved = await this.indicators.update(indicator);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "sector_library.update_applied", entityType: "indicator", entityId: indicator.id, projectId: indicator.projectId, newValue: applied.join(",") || "seen" });
    return { ok: true, value: { applied } };
  }
}
