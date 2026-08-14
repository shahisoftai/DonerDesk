import { randomBytes } from "node:crypto";
import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IOrganizationRepository } from "../../ports/identity.js";
import type { IGoogleDriveConnector } from "../../ports/infrastructure.js";
import type { IAuditLogger } from "../../ports/core.js";

/**
 * Two-phase handler for connecting a tenant's Google Drive during onboarding.
 *
 * Phase 1 (begin): build a Google consent URL for the tenant.
 * Phase 2 (complete): exchange the authorization code for a refresh token,
 * persist it, and set the tenant's storageProvider to GOOGLE_DRIVE.
 *
 * The refresh token storage itself is owned by the infrastructure layer (a
 * tenant-scoped, encrypted CONNECTOR configuration); this handler only decides
 * the outcome and records the audit event.
 */
export class ConnectGoogleDriveHandler {
  constructor(
    private readonly connector: IGoogleDriveConnector,
    private readonly orgs: IOrganizationRepository,
    private readonly saveRefreshToken: (tenantId: string, refreshToken: string) => Promise<Result<void, DomainError>>,
    private readonly audit: IAuditLogger,
  ) {}

  async begin(ctx: AuthenticatedContext): Promise<Result<{ authUrl: string; state: string }, DomainError>> {
    const state = randomBytes(24).toString("hex");
    const result = await this.connector.buildAuthUrl(state);
    if (!result.authUrl) return { ok: false, error: DomainError.invariant("Google Drive is not configured") };
    return { ok: true, value: { authUrl: result.authUrl, state } };
  }

  async complete(ctx: AuthenticatedContext, code: string): Promise<Result<{ storageProvider: "GOOGLE_DRIVE" }, DomainError>> {
    const exchanged = await this.connector.exchangeCode(code);
    if (!exchanged.refreshToken) return { ok: false, error: DomainError.invariant("Google Drive authorization failed") };

    const saved = await this.saveRefreshToken(ctx.tenant.tenantId.toString(), exchanged.refreshToken);
    if (!saved.ok) return saved;

    const orgResult = await this.orgs.findByTenant(ctx.tenant.tenantId);
    if (!orgResult.ok) return orgResult;
    if (!orgResult.value) return { ok: false, error: DomainError.notFound("Organization", ctx.tenant.tenantId.toString()) };
    const org = orgResult.value;
    org.updateProfile({ storageProvider: "GOOGLE_DRIVE" });
    const updated = await this.orgs.update(org);
    if (!updated.ok) return updated;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "storage.google_drive.connected",
      entityType: "organization",
      entityId: org.id,
      newValue: exchanged.email ?? "google-drive",
    });

    return { ok: true, value: { storageProvider: "GOOGLE_DRIVE" } };
  }
}
