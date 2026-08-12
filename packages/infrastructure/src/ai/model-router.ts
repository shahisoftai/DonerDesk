import { DomainError, type Jurisdictions, type LlmCapability, type LlmModel } from "@donordesk/domain";

export interface ModelRoutingRequest {
  capability: LlmCapability;
  jurisdiction: Jurisdictions;
  requiredTokens?: number;
}

export class CompliantModelRouter {
  select(models: LlmModel[], request: ModelRoutingRequest): LlmModel {
    if (request.requiredTokens !== undefined && (!Number.isInteger(request.requiredTokens) || request.requiredTokens < 1)) {
      throw DomainError.validation("Required tokens must be a positive integer");
    }
    const eligible = models.filter((model) =>
      model.isActive &&
      model.capabilities.includes(request.capability) &&
      model.jurisdiction === request.jurisdiction &&
      (request.requiredTokens === undefined || model.maxTokens >= request.requiredTokens)
    );
    if (eligible.length === 0) {
      throw DomainError.notFound("CompliantModel", `${request.capability}:${request.jurisdiction}`);
    }
    return [...eligible].sort((left, right) =>
      left.costPer1kTokens - right.costPer1kTokens || left.name.localeCompare(right.name) || left.version.localeCompare(right.version)
    )[0]!;
  }
}
