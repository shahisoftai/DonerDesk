import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IUserRepository } from "../../ports/identity.js";

export class ListUsersHandler {
  constructor(private readonly users: IUserRepository) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<Array<{ id: string; name: string; email: string; role: string; status: string }>, DomainError>> {
    const r = await this.users.listByTenant(ctx.tenant.tenantId);
    if (!r.ok) return r;
    return {
      ok: true,
      value: r.value.map((u) => ({
        id: u.id.toString(),
        name: u.name,
        email: u.email.toString(),
        role: u.role,
        status: u.status,
      })),
    };
  }
}
