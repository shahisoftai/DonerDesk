export type DomainErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "INVARIANT_VIOLATION"
  | "INVALID_STATE_TRANSITION"
  | "POLICY_DENIED";

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
}
