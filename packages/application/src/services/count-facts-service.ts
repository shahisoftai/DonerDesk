import { countFactsFrom, normalizeLocationKey, type CountFacts, type DataSheet, type Project, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";
import type { IPlaceRepository } from "../ports/places.js";
import type { IFundingSourceRepository, IProjectFundingRepository } from "../ports/finance-register.js";

/** Reads the facts a card's counts need (Phase 50.3). Undefined parts mean "not available here", never zero. */
export interface ICountFactsReader {
  read(ctx: AuthenticatedContext, projectIds: readonly string[], sheets: readonly DataSheet[], options?: { shareLink?: boolean }): Promise<CountFacts>;
}

/** The places list as a tree for the filter bar (Phase 50.3): provinces, then the districts inside each. Undefined when it cannot be read. */
export interface IPlaceTreeReader {
  tree(ctx: AuthenticatedContext): Promise<Array<{ key: string; label: string; level: number; parentKey: string | null }> | undefined>;
}

/**
 * The counts are gathered under the viewer's own access, from the ordinary readers: the places list, the projects the viewer can see,
 * and, only when the viewer may see the project's finance (the same check the number tiles use), the funding sources it has money
 * from (the donor named on a project is on its page for anyone who can see it). Through a share link the funding sources are read for their
 * names only, to be counted: a link carries the number of donors and partners, never their names or any amount.
 */
export class CountFactsService implements ICountFactsReader, IPlaceTreeReader {
  constructor(
    private readonly places: Pick<IPlaceRepository, "list">,
    private readonly projects: { findById(id: string, tenantId: AuthenticatedContext["tenant"]["tenantId"]): Promise<Result<Project | null>> },
    private readonly financeGate: { finance(ctx: AuthenticatedContext, projectId: string): Promise<unknown | undefined> },
    private readonly funding?: Pick<IProjectFundingRepository, "listForProjects">,
    private readonly sources?: Pick<IFundingSourceRepository, "list">,
  ) {}

  async tree(ctx: AuthenticatedContext): Promise<Array<{ key: string; label: string; level: number; parentKey: string | null }> | undefined> {
    const listed = await this.places.list(ctx.tenant.tenantId);
    if (!listed.ok) return undefined;
    const live = listed.value.filter((p) => !p.archived);
    const keyOf = new Map(live.map((p) => [p.id, normalizeLocationKey(p.name)] as const));
    return live.map((p) => ({ key: keyOf.get(p.id)!, label: p.name, level: p.adminLevel, parentKey: p.parentId ? keyOf.get(p.parentId) ?? null : null })).sort((a, b) => a.level - b.level || a.label.localeCompare(b.label));
  }

  async read(ctx: AuthenticatedContext, projectIds: readonly string[], sheets: readonly DataSheet[], options: { shareLink?: boolean } = {}): Promise<CountFacts> {
    const tenantId = ctx.tenant.tenantId;
    const [placeList, projectRows] = await Promise.all([this.places.list(tenantId), Promise.all(projectIds.map((id) => this.projects.findById(id, tenantId)))]);
    const projects = projectRows.flatMap((r) => (r.ok && r.value ? [r.value] : []));
    let fundingSourceNames: string[] = [];
    // A link names its projects itself, so there is no finance gate to ask: only the names of the funding sources are read, and counted.
    if (this.funding && this.sources) {
      const gates = options.shareLink ? projectIds.map(() => true) : await Promise.all(projectIds.map((id) => this.financeGate.finance(ctx, id)));
      const allowed = projectIds.filter((_, i) => gates[i] !== undefined);
      if (allowed.length > 0) {
        const [rows, list] = await Promise.all([this.funding.listForProjects(allowed, tenantId), this.sources.list(tenantId)]);
        if (rows.ok && list.ok) { const name = new Map(list.value.map((s) => [s.id, s.name])); fundingSourceNames = rows.value.map((r) => name.get(r.fundingSourceId) ?? "").filter(Boolean); }
      }
    }
    const facts = countFactsFrom({
      sheets,
      places: placeList.ok ? placeList.value.map((p) => ({ id: p.id, name: p.name, aliases: p.aliases, adminLevel: p.adminLevel, parentId: p.parentId, facility: p.facility, facilityType: p.facilityType, archived: p.archived })) : [],
      projects: projects.map((p) => ({ donorName: p.donorName, partnerOrganization: p.partnerOrganization ?? null })),
      fundingSourceNames,
    });
    return {
      ...(placeList.ok ? { placesWithValues: facts.placesWithValues, facilities: facts.facilities } : {}),
      donors: facts.donors, partners: facts.partners,
    };
  }
}
