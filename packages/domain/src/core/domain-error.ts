export type DomainErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "INVARIANT_VIOLATION"
  | "INVALID_STATE_TRANSITION"
  | "POLICY_DENIED"
  | "PLAN_LIMIT_REACHED"
  | "AI_CREDITS_EXHAUSTED"
  | "BILLING_STATE_INVALID"
  | "BILLING_PROVIDER_UNAVAILABLE"
  | "REPORT_GATE_BLOCKED"
  | "REPORT_CLAIM_VERIFICATION_FAILED"
  | "REPORT_SEMANTICS_UNRESOLVED"
  | "REPORT_TEMPLATE_MAPPING_MISSING";

export class DomainError extends Error {
  public readonly code: DomainErrorCode;
  public readonly details: Record<string, unknown> | undefined;

  constructor(
    code: DomainErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }

  static validation(message: string, details?: Record<string, unknown>): DomainError {
    return new DomainError("VALIDATION_FAILED", message, details);
  }

  static notFound(entity: string, id: string): DomainError {
    return new DomainError("NOT_FOUND", `${entity} not found`, { entity, id });
  }

  static conflict(message: string, details?: Record<string, unknown>): DomainError {
    return new DomainError("CONFLICT", message, details);
  }

  static forbidden(message: string, details?: Record<string, unknown>): DomainError {
    return new DomainError("FORBIDDEN", message, details);
  }

  static invariant(message: string, details?: Record<string, unknown>): DomainError {
    return new DomainError("INVARIANT_VIOLATION", message, details);
  }

  static invalidTransition(message: string, details?: Record<string, unknown>): DomainError {
    return new DomainError("INVALID_STATE_TRANSITION", message, details);
  }

  static policyDenied(message: string, details?: Record<string, unknown>): DomainError {
    return new DomainError("POLICY_DENIED", message, details);
  }

  static planLimitReached(message: string, details?: Record<string, unknown>): DomainError {
    return new DomainError("PLAN_LIMIT_REACHED", message, details);
  }

  static aiCreditsExhausted(message: string, details?: Record<string, unknown>): DomainError {
    return new DomainError("AI_CREDITS_EXHAUSTED", message, details);
  }

  static billingStateInvalid(message: string, details?: Record<string, unknown>): DomainError {
    return new DomainError("BILLING_STATE_INVALID", message, details);
  }

  static billingProviderUnavailable(message: string, details?: Record<string, unknown>): DomainError {
    return new DomainError("BILLING_PROVIDER_UNAVAILABLE", message, details);
  }

  static reportGateBlocked(message: string, details?: Record<string, unknown>): DomainError {
    return new DomainError("REPORT_GATE_BLOCKED", message, details);
  }

  static reportClaimVerificationFailed(message: string, details?: Record<string, unknown>): DomainError {
    return new DomainError("REPORT_CLAIM_VERIFICATION_FAILED", message, details);
  }

  static reportSemanticsUnresolved(message: string, details?: Record<string, unknown>): DomainError {
    return new DomainError("REPORT_SEMANTICS_UNRESOLVED", message, details);
  }

  static reportTemplateMappingMissing(message: string, details?: Record<string, unknown>): DomainError {
    return new DomainError("REPORT_TEMPLATE_MAPPING_MISSING", message, details);
  }
}
