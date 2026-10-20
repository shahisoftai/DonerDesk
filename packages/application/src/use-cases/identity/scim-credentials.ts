import type { Result } from "@donordesk/domain";
import { DomainError, ScimCredential } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IScimCredentialRepository } from "../../ports/identity.js";
import type { IAuditLogger, IIdGenerator } from "../../ports/core.js";

/**
 * Issues a SCIM credential for this organisation. The token is returned once,
 * in the response, and never stored: only its hash is kept, so a leaked
 * database cannot be used to provision users.
 */
export class IssueScimCredentialHandler {
  constructor(
    private readonly credentials: IScimCredentialRepository,
    private readonly ids: IIdGenerator,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: { name: string }): Promise<
    Result<{ id: string; name: string; token: string; createdAt: Date }, DomainError>
  > {
    let created: { credential: ScimCredential; plaintextToken: string };
    try {
      created = ScimCredential.create({
        id: this.ids.generate(),
        tenantId: ctx.tenant.tenantId,
        name: input.name,
        createdById: ctx.tenant.userId,
      });
    } catch (e) {
      return { ok: false, error: e instanceof DomainError ? e : DomainError.validation("Could not issue the credential") };
    }
    const saved = await this.credentials.create(created.credential);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "scim.credential.issued",
      entityType: "scim_credential",
      entityId: created.credential.id,
      projectId: undefined,
    });
    return {
      ok: true,
      value: {
        id: created.credential.id,
        name: created.credential.name,
        token: created.plaintextToken,
        createdAt: created.credential.createdAt,
      },
    };
  }
}

/** The organisation's SCIM credentials. The token is never returned again. */
export class ListScimCredentialsHandler {
  constructor(private readonly credentials: IScimCredentialRepository) {}

  async handle(ctx: AuthenticatedContext): Promise<
    Result<Array<{ id: string; name: string; createdById: string; lastUsedAt: Date | null; revokedAt: Date | null; createdAt: Date }>, DomainError>
  > {
    const listed = await this.credentials.listByTenant(ctx.tenant.tenantId);
    if (!listed.ok) return listed;
    return {
      ok: true,
      value: listed.value.map((c) => ({
        id: c.id,
        name: c.name,
        createdById: c.createdById,
        lastUsedAt: c.lastUsedAt,
        revokedAt: c.revokedAt,
        createdAt: c.createdAt,
      })),
    };
  }
}

/** Revokes a credential. It stops working at once; the row is kept as the record. */
export class RevokeScimCredentialHandler {
  constructor(
    private readonly credentials: IScimCredentialRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, credentialId: string): Promise<Result<void, DomainError>> {
    const found = await this.credentials.findById(credentialId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("ScimCredential", credentialId) };
    if (found.value.isRevoked()) return { ok: true, value: undefined };
    found.value.revoke();
    const saved = await this.credentials.update(found.value);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "scim.credential.revoked",
      entityType: "scim_credential",
      entityId: credentialId,
      projectId: undefined,
    });
    return { ok: true, value: undefined };
  }
}
