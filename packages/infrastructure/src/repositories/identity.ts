import { PrismaClient } from "@prisma/client";
import {
  Organization,
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
          logoUrl: org.logoUrl,
          mainOfficeLocation: org.mainOfficeLocation,
          donorTypesServed: org.donorTypesServed,
          dataResidency: org.dataResidency,
          aiEnabled: org.aiEnabled,
          storageProvider: org.storageProvider,
          reportingDefaults: JSON.stringify(org.reportingDefaults),
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
          logoUrl: org.logoUrl,
          mainOfficeLocation: org.mainOfficeLocation,
          donorTypesServed: org.donorTypesServed,
          dataResidency: org.dataResidency,
          aiEnabled: org.aiEnabled,
          storageProvider: org.storageProvider,
          reportingDefaults: JSON.stringify(org.reportingDefaults),
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
    return ok(this.toDomain(row as typeof row & { aiEnabled?: boolean }));
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<Organization | null, DomainError>> {
    const row = await this.prisma.organization.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row as typeof row & { aiEnabled?: boolean }));
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
    logoUrl: string | null;
    mainOfficeLocation: string | null;
    donorTypesServed: string | null;
    dataResidency: string;
    aiEnabled?: boolean;
    storageProvider?: string;
    reportingDefaults?: string | null;
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
        logoUrl: row.logoUrl ?? undefined,
        mainOfficeLocation: row.mainOfficeLocation ?? undefined,
        donorTypesServed: row.donorTypesServed ?? undefined,
        dataResidency: row.dataResidency as import("@donordesk/domain").DataResidency,
        aiEnabled: row.aiEnabled ?? true,
        storageProvider: (row.storageProvider as import("@donordesk/domain").StorageProvider) ?? "LOCAL",
        reportingDefaults: JSON.parse(row.reportingDefaults ?? "{}") as import("@donordesk/domain").OrganizationReportingDefaults,
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
        },
      });
      return ok(user);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<User | null, DomainError>> {
    const row = await this.prisma.user.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async findByEmail(email: string, tenantId: TenantId): Promise<Result<User | null, DomainError>> {
    const row = await this.prisma.user.findFirst({ where: { email: email.toLowerCase(), tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async findByEmailGlobal(email: string): Promise<Result<User | null, DomainError>> {
    const row = await this.prisma.user.findFirst({ where: { email: email.toLowerCase() } });
    if (!row) return ok(null);
    return ok(this.toDomain(row));
  }

  async listByTenant(tenantId: TenantId): Promise<Result<User[], DomainError>> {
    const rows = await this.prisma.user.findMany({ where: { tenantId: tenantId.toString() }, orderBy: { createdAt: "asc" } });
    return ok(rows.map((r) => this.toDomain(r)));
  }

  async setStatus(id: string, tenantId: TenantId, status: UserStatus): Promise<Result<User, DomainError>> {
    await this.prisma.user.update({ where: { id }, data: { status } });
    const found = await this.findById(id, tenantId);
    if (!found.ok) return { ok: false, error: found.error };
    if (!found.value) return { ok: false, error: DomainError.notFound("User", id) };
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
      },
    });
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
        },
      });
      return ok(invitation);
    } catch (e) {
      return err(new DomainError("CONFLICT", String(e)));
    }
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
      },
    }));
  }
}
