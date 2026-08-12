import { DomainError, ok, err, type Result, type TenantId } from "@donordesk/domain";

export { ok, err };
export type { Result };

export function tenantString(tenantId: TenantId): string {
  return tenantId.toString();
}

export function reErr<T>(message: string, code: "NOT_FOUND" | "VALIDATION_FAILED" | "CONFLICT" | "FORBIDDEN" | "INVARIANT_VIOLATION" = "VALIDATION_FAILED"): Result<T, DomainError> {
  return err(new DomainError(code, message));
}
