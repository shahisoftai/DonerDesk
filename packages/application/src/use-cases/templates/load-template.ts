import { DomainError, type DonorTemplate, type Result, type TenantId } from "@donordesk/domain";
import type { IDonorTemplateRepository } from "../../ports/templates.js";

export async function loadTemplate(repo: IDonorTemplateRepository, id: string, tenantId: TenantId): Promise<Result<DonorTemplate, DomainError>> {
  const r = await repo.findById(id, tenantId);
  if (!r.ok) return r;
  if (!r.value) return { ok: false, error: DomainError.notFound("DonorTemplate", id) };
  return { ok: true, value: r.value };
}

/** Optimistic concurrency: the client edited the version it last read. */
export function checkExpectedVersion(template: DonorTemplate, expectedVersion: number | undefined): Result<void, DomainError> {
  if (expectedVersion !== undefined && expectedVersion !== template.version) {
    return {
      ok: false,
      error: DomainError.conflict("This template was changed by someone else. Reload to see the latest version.", {
        expectedVersion,
        currentVersion: template.version,
      }),
    };
  }
  return { ok: true, value: undefined };
}

/** Converts a thrown domain validation into a Result (domain factories throw). */
export function attempt<T>(fn: () => T): Result<T, DomainError> {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error };
    return { ok: false, error: DomainError.validation(error instanceof Error ? error.message : String(error)) };
  }
}
