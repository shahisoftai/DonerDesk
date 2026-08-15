import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { IOrganizationRepository, IUserRepository, IAuthProvider } from "../../ports/identity.js";
import type { IIdGenerator } from "../../ports/core.js";
import type { IAuditLogger } from "../../ports/core.js";
import { ProvisionTenantHandler } from "./provision-tenant.js";
import type { IClock } from "../../ports/core.js";

export interface SignUpCommand {
  name: string;
  email: string;
  password: string;
  organization: {
    name: string;
    organizationType: import("@donordesk/domain").OrganizationType;
    country: string;
    primarySector: import("@donordesk/domain").Sector;
    defaultLanguage?: import("@donordesk/domain").LanguageCode;
    dataResidency?: import("@donordesk/domain").DataResidency;
    aiEnabled?: boolean;
  };
  /** Requested plan from signup (?plan=). Validated; invalid becomes STARTER. */
  requestedPlan?: string;
}

export class SignUpHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly orgs: IOrganizationRepository,
    private readonly users: IUserRepository,
    private readonly auth: IAuthProvider,
    private readonly events: { publish(_events: unknown[]): Promise<void> },
    private readonly audit: IAuditLogger,
    private readonly provisioner: ProvisionTenantHandler,
  ) {}

  async handle(cmd: SignUpCommand): Promise<Result<{ userId: string; tenantId: string; token: string; plan: string }, DomainError>> {
    const passwordHash = await this.auth.hashPassword(cmd.password);
    const provisioned = await this.provisioner.handle({
      name: cmd.name,
      email: cmd.email,
      passwordHash,
      verifiedEmail: cmd.email,
      requestedPlan: cmd.requestedPlan,
      organization: {
        name: cmd.organization.name,
        organizationType: cmd.organization.organizationType,
        country: cmd.organization.country,
        primarySector: cmd.organization.primarySector,
        defaultLanguage: cmd.organization.defaultLanguage ?? "en",
        dataResidency: cmd.organization.dataResidency ?? "DEFAULT",
        aiEnabled: cmd.organization.aiEnabled ?? true,
        storageProvider: "LOCAL",
      },
    });
    if (!provisioned.ok) return provisioned;

    const value = provisioned.value;
    const token = await this.auth.sign(
      {
        sub: value.userId,
        tid: value.tenantId,
        role: "ADMIN",
        name: cmd.name,
        email: cmd.email,
      },
      60 * 60 * 24 * 7,
    );

    return {
      ok: true,
      value: { userId: value.userId, tenantId: value.tenantId, token, plan: value.plan },
    };
  }
}
