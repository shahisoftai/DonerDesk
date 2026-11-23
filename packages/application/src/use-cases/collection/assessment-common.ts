import { DomainError, Permissions, type Result, type Role, type TenantId } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ICollectionFormRepository, StoredCollectionForm } from "../../ports/collection.js";

/** What the assessment handlers share: the permission check, the result shorthands and loading a form. */
export const can = (ctx: AuthenticatedContext, permission: Parameters<typeof Permissions.can>[1]): boolean => Permissions.can(ctx.tenant.role as Role, permission);
export const fail = <T>(error: DomainError): Result<T, DomainError> => ({ ok: false, error });
export const ok = <T>(value: T): Result<T, DomainError> => ({ ok: true, value });

export async function loadForm(repo: Pick<ICollectionFormRepository, "findById">, id: string, tenantId: TenantId): Promise<Result<StoredCollectionForm, DomainError>> {
  const found = await repo.findById(id, tenantId);
  if (!found.ok) return found;
  if (!found.value) return fail(DomainError.notFound("Form", id));
  return ok(found.value);
}

export const placeKeyOf = (placeId: string | undefined): string => placeId ?? "";
