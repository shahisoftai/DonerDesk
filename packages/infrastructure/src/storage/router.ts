import type { IEvidenceStorage, IEvidenceStorageResolver, IProjectWorkspaceService, IStorage } from "@donordesk/application";
import type { TenantId, StorageProvider } from "@donordesk/domain";
import { LocalEvidenceStorage } from "./local-evidence.js";
import { GoogleDriveEvidenceStorage } from "./google-drive.js";
import type { GoogleDriveAccessTokenStore } from "./google-drive.js";
import { R2EvidenceStorage } from "./r2.js";
import type { R2StorageConfig } from "./r2.js";
import { LocalStorage } from "./local-storage.js";

/**
 * Resolves the per-tenant evidence storage adapter from the tenant's configured
 * storage strategy. Falls back to LOCAL when the tenant has not chosen a
 * strategy (default) or when the adapter is not configured.
 */
export class EvidenceStorageResolver implements IEvidenceStorageResolver {
  private readonly local: LocalEvidenceStorage;
  private googleDrive: GoogleDriveEvidenceStorage | null = null;
  private r2: R2EvidenceStorage | null = null;

  constructor(
    byteStorage: IStorage,
    private readonly getProvider: (tenantId: TenantId) => Promise<StorageProvider>,
    googleDriveTokens?: GoogleDriveAccessTokenStore,
    r2Config?: R2StorageConfig,
    workspace?: IProjectWorkspaceService,
  ) {
    this.local = new LocalEvidenceStorage(byteStorage, workspace, LocalStorage.resolveRoot());
    if (googleDriveTokens) this.googleDrive = new GoogleDriveEvidenceStorage(googleDriveTokens, workspace);
    if (r2Config) this.r2 = new R2EvidenceStorage(r2Config);
  }

  async resolve(tenantId: TenantId): Promise<IEvidenceStorage> {
    let provider: StorageProvider = "LOCAL";
    try {
      provider = await this.getProvider(tenantId);
    } catch {
      provider = "LOCAL";
    }

    if (provider === "GOOGLE_DRIVE" && this.googleDrive) return this.googleDrive;
    if (provider === "R2" && this.r2) return this.r2;
    return this.local;
  }
}
