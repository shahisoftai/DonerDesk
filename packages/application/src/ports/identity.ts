import type { Result, TenantId } from "@donordesk/domain";
import {
  Organization,
  type Invitation,
  type User,
  type Role,
  type Email,
  type OrganizationProps,
  type OrganizationType,
  type Sector,
  type LanguageCode,
  type UserStatus,
} from "@donordesk/domain";

export interface CreateOrganizationInput {
  id: string;
  tenantId: TenantId;
  name: string;
  organizationType: OrganizationType;
  country: string;
  primarySector: Sector;
  defaultLanguage: LanguageCode;
  contactName: string;
  contactEmail: string;
}

export interface IOrganizationRepository {
  create(org: Organization): Promise<Result<Organization>>;
  update(org: Organization): Promise<Result<Organization>>;
  findByTenant(tenantId: TenantId): Promise<Result<Organization | null>>;
  findById(id: string, tenantId: TenantId): Promise<Result<Organization | null>>;
}

export interface CreateUserInput {
  id: string;
  tenantId: TenantId;
  email: Email;
  name: string;
  passwordHash: string;
  role: Role;
}

export interface IUserRepository {
  create(user: User): Promise<Result<User>>;
  update(user: User): Promise<Result<User>>;
  findById(id: string, tenantId: TenantId): Promise<Result<User | null>>;
  findByEmail(email: string, tenantId: TenantId): Promise<Result<User | null>>;
  findByEmailGlobal(email: string): Promise<Result<User | null>>;
  listByTenant(tenantId: TenantId): Promise<Result<User[]>>;
  setStatus(id: string, tenantId: TenantId, status: UserStatus): Promise<Result<User>>;
}

export interface IInvitationRepository {
  create(invitation: Invitation): Promise<Result<Invitation>>;
  findByToken(token: string): Promise<Result<Invitation | null>>;
}

export interface AuthenticatedUser {
  userId: string;
  tenantId: TenantId;
  role: Role;
  email: string;
  name: string;
}

export interface IAuthProvider {
  hashPassword(plain: string): Promise<string>;
  verifyPassword(plain: string, hash: string): Promise<boolean>;
  sign(payload: { sub: string; tid: string; role: Role; name: string; email: string }, ttlSeconds: number): Promise<string>;
  verify(token: string): Promise<AuthenticatedUser | null>;
}
