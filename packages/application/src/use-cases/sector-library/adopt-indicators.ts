import type { CreateIndicatorInput } from "@donordesk/contracts";
import type { LibraryIndicator, Result } from "@donordesk/domain";
import { BUILT_IN_CONTENT, DomainError, indicatorFieldsOf, linkOf, pickNodeFor, projectCodeFor } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { IIndicatorRepository, ILogframeRepository } from "../../ports/logframe.js";
import type { EffectiveLibraryService } from "../../services/effective-library.js";

/** The one way an indicator is created: the ordinary handler (its checks, its audit). The library adds nothing of its own to write. */
export interface IndicatorCreator { handle(ctx: AuthenticatedContext, input: CreateIndicatorInput): Promise<Result<{ id: string }, DomainError>> }

export interface AdoptItem { libraryId: string; /** Where it goes in the results framework. Without it the result whose wording fits best is used; none fits, it is skipped. */ logframeItemId?: string | undefined }
export interface AdoptInput { projectId: string; items: readonly AdoptItem[] }
export interface AdoptResult {
  created: Array<{ libraryId: string; indicatorId: string; code: string }>;
  skipped: Array<{ libraryId: string; reason: string }>;
}

/**
 * Copies library entries into a project as its own indicators. The entry is copied (never referenced) and a link remembers which
 * entry and version it came from. A person puts each where it belongs; if they do not, the result whose wording fits best is used, and when none fits the indicator is skipped with a plain sentence rather than put somewhere by guess.
 * Baseline and target are left empty: the library never sets a target.
 */
export class AdoptLibraryIndicatorsHandler {
  constructor(
    private readonly library: EffectiveLibraryService,
    private readonly indicators: IIndicatorRepository,
    private readonly logframe: ILogframeRepository,
    private readonly creator: IndicatorCreator,
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, input: AdoptInput): Promise<Result<AdoptResult, DomainError>> {
    if (input.items.length === 0) return { ok: false, error: DomainError.validation("Choose at least one indicator.") };
    if (input.items.length > 100) return { ok: false, error: DomainError.validation("Add at most 100 indicators at a time.") };
    const tenantId = ctx.tenant.tenantId;
    const lib = await this.library.forTenant(tenantId);
    if (!lib.ok) return lib;
    const existing = await this.indicators.findByProject(input.projectId, tenantId, { includeArchived: true });
    if (!existing.ok) return existing;
    const nodes = await this.logframe.findByProject(input.projectId, tenantId);
    if (!nodes.ok) return nodes;
    const taken = new Set<string>([...existing.value.map((i) => i.code), ...nodes.value.flatMap((n) => (n.code ? [n.code] : []))]);
    const adopted = new Set(existing.value.flatMap((i) => (i.libraryId && !i.isArchived ? [i.libraryId] : [])));
    const nodeById = new Map(nodes.value.map((n) => [n.id, n] as const));
    const result: AdoptResult = { created: [], skipped: [] };
    const today = this.clock.now().toISOString().slice(0, 10);

    for (const item of input.items) {
      const skip = (reason: string) => result.skipped.push({ libraryId: item.libraryId, reason });
      const entry: LibraryIndicator | undefined = lib.value.byId.get(item.libraryId);
      if (!entry) { skip("This indicator is not in the library."); continue; }
      if (adopted.has(entry.id)) { skip("The project already has this indicator."); continue; }
      let nodeId = item.logframeItemId;
      if (nodeId) {
        const node = nodeById.get(nodeId);
        if (!node || node.projectId !== input.projectId) { skip("That result is not in this project."); continue; }
      } else {
        const node = pickNodeFor(entry, nodes.value, BUILT_IN_CONTENT[entry.sectorId].logframe);
        if (!node) { skip("No result of this project fits this indicator. Choose where it goes."); continue; }
        nodeId = node.id;
      }
      const code = projectCodeFor(entry, taken);
      const f = indicatorFieldsOf(entry, code);
      const created = await this.creator.handle(ctx, {
        projectId: input.projectId, logframeItemId: nodeId, code, name: f.name.slice(0, 300), type: f.type, baseline: "", target: "",
        unit: f.unit.slice(0, 50), meansOfVerification: f.meansOfVerification.slice(0, 500), dataSource: f.dataSource.slice(0, 500), frequency: f.frequency.slice(0, 50),
        disaggregationRequired: false,
        library: { id: entry.id, version: entry.version, linkJson: JSON.stringify(linkOf(entry, today)) },
        semantics: { aggregation: f.semantics.aggregation as "SUM" | "AVERAGE" | "LATEST", direction: f.semantics.direction, reportingBasis: f.semantics.reportingBasis, status: f.semantics.status as "INFERRED" | "REQUIRES_REVIEW" },
      });
      if (!created.ok) { skip(created.error.message); continue; }
      taken.add(code);
      adopted.add(entry.id);
      result.created.push({ libraryId: entry.id, indicatorId: created.value.id, code });
    }
    if (result.created.length > 0) {
      await this.audit.record({ tenantId, actorId: ctx.tenant.userId, eventType: "sector_library.adopted", entityType: "project", entityId: input.projectId, projectId: input.projectId, newValue: `${result.created.length} indicators from the sector library` });
    }
    return { ok: true, value: result };
  }
}
