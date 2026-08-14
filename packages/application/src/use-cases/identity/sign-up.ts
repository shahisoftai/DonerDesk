import type { Result } from "@donordesk/domain";
import { DomainError, Organization, User, Email, TenantId, UserId, DataResidency } from "@donordesk/domain";
import type { IOrganizationRepository, IUserRepository, IAuthProvider } from "../../ports/identity.js";
import type { IIdGenerator } from "../../ports/core.js";
import type { IAuditLogger, IEventBus } from "../../ports/core.js";

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
    dataResidency?: DataResidency;
    aiEnabled?: boolean;
  };
}

export class SignUpHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly orgs: IOrganizationRepository,
    private readonly users: IUserRepository,
    private readonly auth: IAuthProvider,
    private readonly events: IEventBus,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(cmd: SignUpCommand): Promise<Result<{ userId: string; tenantId: string; token: string }, DomainError>> {
    const tenantIdStr = this.ids.generate();
    const tenantId = TenantId.create(tenantIdStr);
    const orgId = this.ids.generate();
    const userId = this.ids.generate();

    const org = Organization.create({
      id: orgId,
      tenantId,
      props: {
        name: cmd.organization.name,
        organizationType: cmd.organization.organizationType,
        country: cmd.organization.country,
        sectors: [cmd.organization.primarySector],
        contactName: cmd.name,
        contactEmail: cmd.email,
        defaultLanguage: cmd.organization.defaultLanguage ?? "en",
        dataResidency: cmd.organization.dataResidency ?? "DEFAULT",
        aiEnabled: cmd.organization.aiEnabled ?? true,
        storageProvider: "LOCAL",
      },
    });

    const orgResult = await this.orgs.create(org);
    if (!orgResult.ok) return orgResult;

    const passwordHash = await this.auth.hashPassword(cmd.password);
    const user = User.create({
      id: UserId.create(userId),
      tenantId,
      email: Email.create(cmd.email),
      name: cmd.name,
      passwordHash,
      role: "ADMIN",
    });
    user.activate();
    const userResult = await this.users.create(user);
    if (!userResult.ok) return userResult;

    await this.audit.record({
      tenantId,
      actorId: userId,
      eventType: "identity.user.created",
      entityType: "user",
      entityId: userId,
    });

    const token = await this.auth.sign(
      {
        sub: userId,
        tid: tenantIdStr,
        role: "ADMIN",
        name: cmd.name,
        email: cmd.email,
      },
      60 * 60 * 24 * 7,
    );

    return { ok: true, value: { userId, tenantId: tenantIdStr, token } };
  }
}
