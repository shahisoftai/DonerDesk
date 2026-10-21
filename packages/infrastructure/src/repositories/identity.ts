import { PrismaClient } from "@prisma/client";
import {
  Organization,
  PasswordResetToken,
  ScimCredential,
  TenantId,
  User,
  Email,
  UserId,
  Role,
  UserStatus,
  Invitation,
  DomainError,
  type Result,
} from "@donordesk/domain";
import type {
  IOrganizationRepository,
  IUserRepository,
  IInvitationRepository,
  IPasswordResetTokenRepository,
  IScimCredentialRepository,
} from "@donordesk/application";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

function err<T = never>(e: DomainError): Result<T, DomainError> {
  return { ok: false, error: e };
}

export class PrismaOrganizationRepository implements IOrganizationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(org: Organization): Promise<Result<Organization, DomainError>> {
    try {
      await this.prisma.organization.create({
        data: {
          id: org.id,
          tenantId: org.tenantId.toString(),
          name: org.name,
          organizationType: org.organizationType,
          country: org.country,
          sectors: JSON.stringify(org.sectors),
          contactName: org.contactName,
          contactEmail: org.contactEmail,
          website: org.website,
          defaultLanguage: org.defaultLanguage,
          timeZone: org.timeZone,
          logoUrl: org.logoUrl,
          mainOfficeLocation: org.mainOfficeLocation,
          donorTypesServed: org.donorTypesServed,
          dataResidency: org.dataResidency,
          aiEnabled: org.aiEnabled,
          storageProvider: org.storageProvider,
          reportingDefaults: JSON.stringify(org.reportingDefaults),
          agentMemoryEnabled: org.agentMemoryEnabled,
          nonprofitVerifiedAt: org.nonprofitVerifiedAt,
        } as Parameters<typeof this.prisma.organization.create>[0]["data"],
      });
      return ok(org);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async update(org: Organization): Promise<Result<Organization, DomainError>> {
    try {
      await this.prisma.organization.update({
        where: { id: org.id },
        data: {
          name: org.name,
          organizationType: org.organizationType,
          country: org.country,
          sectors: JSON.stringify(org.sectors),
          contactName: org.contactName,
          contactEmail: org.contactEmail,
          website: org.website,
          defaultLanguage: org.defaultLanguage,
          timeZone: org.timeZone,
          logoUrl: org.logoUrl,
          mainOfficeLocation: org.mainOfficeLocation,
          donorTypesServed: org.donorTypesServed,
          dataResidency: org.dataResidency,
          aiEnabled: org.aiEnabled,
          storageProvider: org.storageProvider,
          reportingDefaults: JSON.stringify(org.reportingDefaults),
          agentMemoryEnabled: org.agentMemoryEnabled,
          nonprofitVerifiedAt: org.nonprofitVerifiedAt,
        } as Parameters<typeof this.prisma.organization.update>[0]["data"],
      });
      return ok(org);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async findByTenant(tenantId: TenantId): Promise<Result<Organization | null, DomainError>> {
    const row = await this.prisma.organization.findUnique({ where: { tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row as typeof row & { aiEnabled?: boolean; agentMemoryEnabled?: boolean }));
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<Organization | null, DomainError>> {
    const row = await this.prisma.organization.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row as typeof row & { aiEnabled?: boolean; agentMemoryEnabled?: boolean }));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    name: string;
    organizationType: string;
    country: string;
    sectors: string;
    contactName: string;
    contactEmail: string;
    website: string | null;
    defaultLanguage: string;
    timeZone?: string | null;
    logoUrl: string | null;
    mainOfficeLocation: string | null;
    donorTypesServed: string | null;
    dataResidency: string;
    aiEnabled?: boolean;
    storageProvider?: string;
    reportingDefaults?: string | null;
    agentMemoryEnabled?: boolean;
    nonprofitVerifiedAt?: Date | null;
    createdAt: Date;
  }): Organization {
    return Organization.rehydrate({
      id: row.id,
      tenantId: TenantId.create(row.tenantId),
      createdAt: row.createdAt,
      props: {
        name: row.name,
        organizationType: row.organizationType as import("@donordesk/domain").OrganizationType,
        country: row.country,
        sectors: JSON.parse(row.sectors) as import("@donordesk/domain").Sector[],
        contactName: row.contactName,
        contactEmail: row.contactEmail,
        website: row.website ?? undefined,
        defaultLanguage: row.defaultLanguage as import("@donordesk/domain").LanguageCode,
        // Stored organisations always have a zone (UTC unless set); only a new one is suggested from its country.
        timeZone: row.timeZone ?? "UTC",
        logoUrl: row.logoUrl ?? undefined,
        mainOfficeLocation: row.mainOfficeLocation ?? undefined,
        donorTypesServed: row.donorTypesServed ?? undefined,
        dataResidency: row.dataResidency as import("@donordesk/domain").DataResidency,
        aiEnabled: row.aiEnabled ?? true,
        storageProvider: (row.storageProvider as import("@donordesk/domain").StorageProvider) ?? "LOCAL",
        reportingDefaults: JSON.parse(row.reportingDefaults ?? "{}") as import("@donordesk/domain").OrganizationReportingDefaults,
        agentMemoryEnabled: row.agentMemoryEnabled ?? false,
        nonprofitVerifiedAt: row.nonprofitVerifiedAt ?? undefined,
      },
    });
  }
}

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(user: User): Promise<Result<User, DomainError>> {
    try {
      await this.prisma.user.create({
        data: {
          id: user.id.toString(),
          tenantId: user.tenantId.toString(),
          email: user.email.toString(),
          name: user.name,
          passwordHash: user.passwordHash,
          role: user.role,
          status: user.status,
          lastLoginAt: user.lastLoginAt,
          assignedProjectIds: JSON.stringify(user.assignedProjectIds),
          passwordChangedAt: user.passwordChangedAt,
          failedLoginCount: user.failedLoginCount,
          lockedUntil: user.lockedUntil,
          external: user.external,
          mfaSecretEnc: user.mfaSecretEnc,
          mfaPendingSecretEnc: user.mfaPendingSecretEnc,
          mfaEnabledAt: user.mfaEnabledAt,
          mfaRecoveryHashes: JSON.stringify(user.mfaRecoveryHashes),
          mfaLastStep: user.mfaLastStep,
        },
      });
      return ok(user);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async update(user: User): Promise<Result<User, DomainError>> {
    try {
      await this.prisma.user.update({
        where: { id: user.id.toString() },
        data: {
          email: user.email.toString(),
          name: user.name,
          passwordHash: user.passwordHash,
          role: user.role,
          status: user.status,
          lastLoginAt: user.lastLoginAt,
          assignedProjectIds: JSON.stringify(user.assignedProjectIds),
          passwordChangedAt: user.passwordChangedAt,
          failedLoginCount: user.failedLoginCount,
          lockedUntil: user.lockedUntil,
          external: user.external,
          mfaSecretEnc: user.mfaSecretEnc,
          mfaPendingSecretEnc: user.mfaPendingSecretEnc,
          mfaEnabledAt: user.mfaEnabledAt,
          mfaRecoveryHashes: JSON.stringify(user.mfaRecoveryHashes),
          mfaLastStep: user.mfaLastStep,
        },
      });
      return ok(user);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async updatePasswordHash(userId: string, tenantId: TenantId, passwordHash: string): Promise<Result<User, DomainError>> {
    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
      });
      if (updated.tenantId !== tenantId.toString()) {
        return err(DomainError.notFound("User", userId));
      }
      return ok(this.toDomain(updated));
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<User | null, DomainError>> {
    const row = await this.prisma.user.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async findByIdGlobal(id: string): Promise<Result<User | null, DomainError>> {
    const row = await this.prisma.user.findFirst({ where: { id } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async findByEmail(email: string, tenantId: TenantId): Promise<Result<User | null, DomainError>> {
    const row = await this.prisma.user.findFirst({ where: { email: email.toLowerCase(), tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async findByEmailGlobal(email: string): Promise<Result<User | null, DomainError>> {
    const row = await this.prisma.user.findFirst({ where: { email: email.toLowerCase() }, orderBy: { createdAt: "asc" } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async listByTenant(tenantId: TenantId): Promise<Result<User[], DomainError>> {
    const rows = await this.prisma.user.findMany({ where: { tenantId: tenantId.toString() }, orderBy: { createdAt: "asc" } });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  async setStatus(id: string, tenantId: TenantId, status: UserStatus): Promise<Result<User, DomainError>> {
    // Check the tenant before writing: updating by id alone would let a caller
    // change another organisation's user and only then be told it was not found.
    const found = await this.findById(id, tenantId);
    if (!found.ok) return { ok: false, error: found.error };
    if (!found.value) return { ok: false, error: DomainError.notFound("User", id) };
    await this.prisma.user.update({ where: { id, tenantId: tenantId.toString() }, data: { status } });
    return { ok: true, value: found.value };
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    email: string;
    name: string;
    passwordHash: string;
    role: string;
    status: string;
    lastLoginAt: Date | null;
    assignedProjectIds: string;
    passwordChangedAt?: Date | null;
    failedLoginCount?: number;
    lockedUntil?: Date | null;
    external?: boolean;
    mfaSecretEnc?: string | null;
    mfaPendingSecretEnc?: string | null;
    mfaEnabledAt?: Date | null;
    mfaRecoveryHashes?: string;
    mfaLastStep?: number | null;
    createdAt: Date;
  }): User {
    return User.rehydrate({
      id: UserId.create(row.id),
      tenantId: TenantId.create(row.tenantId),
      createdAt: row.createdAt,
      props: {
        email: Email.create(row.email),
        name: row.name,
        passwordHash: row.passwordHash,
        role: row.role as Role,
        status: row.status as UserStatus,
        lastLoginAt: row.lastLoginAt ?? undefined,
        assignedProjectIds: JSON.parse(row.assignedProjectIds),
        passwordChangedAt: row.passwordChangedAt ?? null,
        failedLoginCount: row.failedLoginCount ?? 0,
        lockedUntil: row.lockedUntil ?? null,
        external: row.external === true,
        mfaSecretEnc: row.mfaSecretEnc ?? null,
        mfaPendingSecretEnc: row.mfaPendingSecretEnc ?? null,
        mfaEnabledAt: row.mfaEnabledAt ?? null,
        mfaRecoveryHashes: parseHashes(row.mfaRecoveryHashes),
        mfaLastStep: row.mfaLastStep ?? null,
      },
    });
  }
}

function parseHashes(json: string | undefined): string[] {
  try {
    const parsed = JSON.parse(json ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((h): h is string => typeof h === "string") : [];
  } catch {
    return [];
  }
}

export class PrismaInvitationRepository implements IInvitationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(invitation: Invitation): Promise<Result<Invitation, DomainError>> {
    try {
      await this.prisma.invitation.create({
        data: {
          id: invitation.id,
          tenantId: invitation.tenantId.toString(),
          email: invitation.email.toString(),
          role: invitation.role,
          invitedById: invitation.invitedById,
          token: invitation.token,
          expiresAt: invitation.expiresAt,
          acceptedAt: invitation.acceptedAt,
          projectIds: JSON.stringify(invitation.projectIds),
          external: invitation.external,
        },
      });
      return ok(invitation);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async listOpenByTenant(tenantId: TenantId): Promise<Result<Invitation[], DomainError>> {
    const rows = await this.prisma.invitation.findMany({
      where: { tenantId: tenantId.toString(), acceptedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return ok(
      rows.map((row) =>
        Invitation.rehydrate({
          id: row.id,
          tenantId: TenantId.create(row.tenantId),
          createdAt: row.createdAt,
          props: {
            email: Email.create(row.email),
            role: row.role as Role,
            invitedById: row.invitedById,
            token: row.token,
            expiresAt: row.expiresAt,
            acceptedAt: undefined,
            projectIds: JSON.parse(row.projectIds) as string[],
            external: row.external === true,
          },
        }),
      ),
    );
  }

  async findByToken(token: string): Promise<Result<Invitation | null, DomainError>> {
    const row = await this.prisma.invitation.findUnique({ where: { token } });
    if (!row) return ok(null);
    return ok(Invitation.rehydrate({
      id: row.id,
      tenantId: TenantId.create(row.tenantId),
      createdAt: row.createdAt,
      props: {
        email: Email.create(row.email),
        role: row.role as Role,
        invitedById: row.invitedById,
        token: row.token,
        expiresAt: row.expiresAt,
        acceptedAt: row.acceptedAt ?? undefined,
        projectIds: JSON.parse(row.projectIds) as string[],
        external: row.external === true,
      },
    }));
  }

  async update(invitation: Invitation): Promise<Result<Invitation, DomainError>> {
    try {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: invitation.acceptedAt },
      });
      return ok(invitation);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }
}

export class PrismaPasswordResetTokenRepository implements IPasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(token: PasswordResetToken): Promise<Result<PasswordResetToken, DomainError>> {
    try {
      await this.prisma.passwordResetToken.create({
        data: {
          id: token.id.toString(),
          tenantId: token.tenantId.toString(),
          userId: token.userId,
          tokenHash: token.tokenHash,
          expiresAt: token.expiresAt,
          usedAt: token.usedAt,
          ipAddress: token.ipAddress,
          userAgent: token.userAgent,
        },
      });
      return ok(token);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async findActiveByHash(tokenHash: string): Promise<Result<PasswordResetToken | null, DomainError>> {
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async markUsed(id: string, tenantId: TenantId): Promise<Result<PasswordResetToken, DomainError>> {
    try {
      const updated = await this.prisma.passwordResetToken.update({
        where: { id },
        data: { usedAt: new Date() },
      });
      if (updated.tenantId !== tenantId.toString()) {
        return err(DomainError.notFound("PasswordResetToken", id));
      }
      return ok(this.toDomain(updated));
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
  }): PasswordResetToken {
    return PasswordResetToken.rehydrate({
      id: row.id,
      tenantId: TenantId.create(row.tenantId),
      createdAt: row.createdAt,
      props: {
        userId: row.userId,
        tokenHash: row.tokenHash,
        expiresAt: row.expiresAt,
        usedAt: row.usedAt,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
      },
    });
  }
}

export class PrismaScimCredentialRepository implements IScimCredentialRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(credential: ScimCredential): Promise<Result<ScimCredential, DomainError>> {
    try {
      await this.prisma.scimCredential.create({
        data: {
          id: credential.id,
          tenantId: credential.tenantId.toString(),
          name: credential.name,
          tokenHash: credential.tokenHash,
          createdById: credential.createdById,
          lastUsedAt: credential.lastUsedAt,
          revokedAt: credential.revokedAt,
        },
      });
      return ok(credential);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async update(credential: ScimCredential): Promise<Result<ScimCredential, DomainError>> {
    try {
      await this.prisma.scimCredential.update({
        where: { id: credential.id },
        data: { name: credential.name, lastUsedAt: credential.lastUsedAt, revokedAt: credential.revokedAt },
      });
      return ok(credential);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  /**
   * By token hash, across organisations: the caller does not yet know which
   * organisation it is, and the token is what tells it. Run on the admin
   * connection, because the runtime role is bound to one tenant.
   */
  async findByTokenHash(tokenHash: string): Promise<Result<ScimCredential | null, DomainError>> {
    const row = await this.prisma.scimCredential.findFirst({ where: { tokenHash } });
    if (!row) return ok(null);
    return ok(
      ScimCredential.rehydrate({
        id: row.id,
        tenantId: TenantId.create(row.tenantId),
        createdAt: row.createdAt,
        props: {
          tenantId: row.tenantId,
          name: row.name,
          tokenHash: row.tokenHash,
          createdById: row.createdById,
          lastUsedAt: row.lastUsedAt,
          revokedAt: row.revokedAt,
        },
      }),
    );
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<ScimCredential | null, DomainError>> {
    const row = await this.prisma.scimCredential.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(
      ScimCredential.rehydrate({
        id: row.id,
        tenantId: TenantId.create(row.tenantId),
        createdAt: row.createdAt,
        props: {
          tenantId: row.tenantId,
          name: row.name,
          tokenHash: row.tokenHash,
          createdById: row.createdById,
          lastUsedAt: row.lastUsedAt,
          revokedAt: row.revokedAt,
        },
      }),
    );
  }

  async listByTenant(tenantId: TenantId): Promise<Result<ScimCredential[], DomainError>> {
    const rows = await this.prisma.scimCredential.findMany({
      where: { tenantId: tenantId.toString() },
      orderBy: { createdAt: "desc" },
    });
    return ok(
      rows.map((row) =>
        ScimCredential.rehydrate({
          id: row.id,
          tenantId: TenantId.create(row.tenantId),
          createdAt: row.createdAt,
          props: {
            tenantId: row.tenantId,
            name: row.name,
            tokenHash: row.tokenHash,
            createdById: row.createdById,
            lastUsedAt: row.lastUsedAt,
            revokedAt: row.revokedAt,
          },
        }),
      ),
    );
  }
}
