import type { TenantId } from "@donordesk/domain";
import type { IIndicatorRepository } from "../ports/logframe.js";
import type { IReportingProfileRepository } from "../ports/setup.js";

export const EVIDENCE_REQUIRED_MESSAGE = "Attach a file that proves this value before it is verified. This project requires evidence for verified values.";

/** Does this project require a file behind an indicator value before it can be verified? (Off unless the project turned it on.) */
export class VerificationEvidencePolicy {
  constructor(private readonly indicators: IIndicatorRepository, private readonly profiles: IReportingProfileRepository) {}

  async requiredForProject(projectId: string, tenantId: TenantId): Promise<boolean> {
    const profile = await this.profiles.findByProject(projectId, tenantId);
    return profile.ok && profile.value?.requireEvidenceForVerification === true;
  }

  async requiredForIndicator(indicatorId: string, tenantId: TenantId): Promise<boolean> {
    const indicator = await this.indicators.findById(indicatorId, tenantId);
    return indicator.ok && indicator.value ? this.requiredForProject(indicator.value.projectId, tenantId) : false;
  }
}
