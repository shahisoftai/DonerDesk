import type { Result, TenantId, StorageProvider, DomainError } from "@donordesk/domain";
import type {
  IProjectWorkspaceService,
  IProjectWorkspaceProviderResolver,
  ProjectWorkspaceProviderConfig,
} from "@donordesk/application";
import { LocalProjectWorkspaceService, GoogleDriveProjectWorkspaceService, type ProjectWorkspaceNameProvider } from "./project-workspace.js";
import { GoogleDriveWorkspaceDrive } from "./google-drive-workspace.js";
import type { GoogleDriveAccessTokenStore } from "./google-drive.js";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

/**
 * Resolves the per-tenant project workspace strategy from the tenant's
 * storageProvider and delegates to the matching service. Follows the same
 * pattern as EvidenceStorageResolver: LOCAL fallback when unconfigured.
 */
export class ProjectWorkspaceServiceResolver implements IProjectWorkspaceService, IProjectWorkspaceProviderResolver {
  private readonly local: LocalProjectWorkspaceService;
  private googleDrive: GoogleDriveProjectWorkspaceService | null = null;

  constructor(
    private readonly names: ProjectWorkspaceNameProvider,
    private readonly getProvider: (tenantId: TenantId) => Promise<StorageProvider>,
    storageRoot: string,
    googleDriveTokens?: GoogleDriveAccessTokenStore,
  ) {
    this.local = new LocalProjectWorkspaceService(storageRoot, names);
    if (googleDriveTokens) {
      this.googleDrive = new GoogleDriveProjectWorkspaceService(names, new GoogleDriveWorkspaceDrive(googleDriveTokens));
    }
  }

  async resolve(tenantId: TenantId): Promise<Result<ProjectWorkspaceProviderConfig, DomainError>> {
    let provider: StorageProvider = "LOCAL";
    try {
      provider = await this.getProvider(tenantId);
    } catch {
      provider = "LOCAL";
    }
    return ok({ provider });
  }

  private pick(provider: StorageProvider): IProjectWorkspaceService {
    if (provider === "GOOGLE_DRIVE" && this.googleDrive) return this.googleDrive;
    return this.local;
  }

  async ensureTenantRoot(tenantId: TenantId) {
    const provider = await this.resolve(tenantId);
    if (!provider.ok) return provider;
    return this.pick(provider.value.provider).ensureTenantRoot(tenantId);
  }

  async ensureProjectWorkspace(tenantId: TenantId, projectId: string) {
    const provider = await this.resolve(tenantId);
    if (!provider.ok) return provider;
    return this.pick(provider.value.provider).ensureProjectWorkspace(tenantId, projectId);
  }

  async verifyAccess(tenantId: TenantId, rootId: string) {
    const provider = await this.resolve(tenantId);
    if (!provider.ok) return provider;
    return this.pick(provider.value.provider).verifyAccess(tenantId, rootId);
  }

  async repairProjectWorkspace(tenantId: TenantId, projectId: string) {
    const provider = await this.resolve(tenantId);
    if (!provider.ok) return provider;
    return this.pick(provider.value.provider).repairProjectWorkspace(tenantId, projectId);
  }

  async listProjectFolderFiles(tenantId: TenantId, projectId: string, role: string) {
    const provider = await this.resolve(tenantId);
    if (!provider.ok) return provider;
    return this.pick(provider.value.provider).listProjectFolderFiles(tenantId, projectId, role);
  }
}

/**
 * Resolves project/tenant display labels for folder naming from the Prisma
 * repositories. Project folders are named "{title} ({projectCode})".
 */
export class PrismaWorkspaceNameProvider implements ProjectWorkspaceNameProvider {
  constructor(
    private readonly findProject: (
      id: string,
      tenantId: TenantId,
    ) => Promise<{ title: string; projectCode: string } | null>,
    private readonly findTenant: (tenantId: TenantId) => Promise<{ name: string } | null>,
  ) {}

  async projectLabel(projectId: string, tenantId: TenantId): Promise<string> {
    const project = await this.findProject(projectId, tenantId);
    return project ? `${project.title} (${project.projectCode})` : projectId;
  }

  async tenantLabel(tenantId: TenantId): Promise<string> {
    const org = await this.findTenant(tenantId);
    return org?.name ?? `tenant-${tenantId.toString()}`;
  }
}
