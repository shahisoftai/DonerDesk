import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IReportClaimRepository, IReportSectionRepository } from "../../ports/reporting.js";

export type EvidenceSupportTarget = { type: "activity" | "indicator"; id: string };

export interface EvidenceSupportFile {
  id: string;
  title: string;
  fileName: string;
  verificationStatus: string;
  /** True when the file is attached as proof (used by reports); false when it is only tagged. */
  attached: boolean;
  /** Report statements that cite this file. */
  citedBy: Array<{ claimId: string; sectionId: string; sectionTitle: string; text: string }>;
}

/**
 * Which files support an activity or an indicator, and which report statements cite each one.
 * Read-only; "cited" is derived from the claims' stored sources, so nothing new is persisted.
 */
export class GetEvidenceSupportHandler {
  constructor(
    private readonly evidence: IEvidenceRepository,
    private readonly activities: IActivityUpdateRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly indicatorUpdates: IIndicatorUpdateRepository,
    private readonly claims: IReportClaimRepository,
    private readonly sections: IReportSectionRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, target: EvidenceSupportTarget): Promise<Result<{ files: EvidenceSupportFile[] }, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    let projectId: string;
    const attachedIds = new Set<string>();
    const taggedFilter: { activityId?: string; indicatorId?: string } = {};

    if (target.type === "activity") {
      const found = await this.activities.findById(target.id, tenantId);
      if (!found.ok) return found;
      if (!found.value) return { ok: false, error: DomainError.notFound("ActivityUpdate", target.id) };
      projectId = found.value.projectId;
      for (const id of found.value.attachedEvidenceIds) attachedIds.add(id);
      taggedFilter.activityId = target.id;
    } else {
      const found = await this.indicators.findById(target.id, tenantId);
      if (!found.ok) return found;
      if (!found.value) return { ok: false, error: DomainError.notFound("Indicator", target.id) };
      projectId = found.value.projectId;
      const updates = await this.indicatorUpdates.findByIndicator(target.id, tenantId);
      if (!updates.ok) return updates;
      for (const u of updates.value) for (const id of u.attachedEvidenceIds) attachedIds.add(id);
      taggedFilter.indicatorId = target.id;
    }

    const tagged = await this.evidence.search({ projectId, ...taggedFilter, pageSize: 200 }, tenantId);
    if (!tagged.ok) return tagged;
    const files = new Map(tagged.value.items.map((e) => [e.id, e]));
    for (const id of attachedIds) {
      if (files.has(id)) continue;
      const one = await this.evidence.findById(id, tenantId);
      if (!one.ok) return one;
      if (one.value && one.value.projectId === projectId) files.set(id, one.value);
    }

    const cited = await this.claims.findCitingEvidence(projectId, [...files.keys()], tenantId);
    if (!cited.ok) return cited;
    const sectionTitles = new Map<string, string>();
    const citedBy = new Map<string, EvidenceSupportFile["citedBy"]>();
    for (const claim of cited.value) {
      if (!sectionTitles.has(claim.sectionId)) {
        const s = await this.sections.findById(claim.sectionId, tenantId);
        sectionTitles.set(claim.sectionId, s.ok && s.value ? s.value.sectionTitle : "Report section");
      }
      for (const src of claim.sources) {
        if (!files.has(src.evidenceId)) continue;
        const list = citedBy.get(src.evidenceId) ?? [];
        if (!list.some((c) => c.claimId === claim.id)) {
          list.push({ claimId: claim.id, sectionId: claim.sectionId, sectionTitle: sectionTitles.get(claim.sectionId)!, text: claim.text });
        }
        citedBy.set(src.evidenceId, list);
      }
    }

    return {
      ok: true,
      value: {
        files: [...files.values()].map((e) => ({
          id: e.id,
          title: e.title,
          fileName: e.fileName,
          verificationStatus: e.verificationStatus,
          attached: attachedIds.has(e.id),
          citedBy: citedBy.get(e.id) ?? [],
        })),
      },
    };
  }
}
