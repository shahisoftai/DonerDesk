import { relative, resolve, sep } from "node:path";
import type { IStorage, IEvidenceStorage, IProjectWorkspaceService, SaveEvidenceInput, EvidenceLocation } from "@donordesk/application";
import { DomainError, type Result, type TenantId } from "@donordesk/domain";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

function fail(message: string): Result<never, DomainError> {
  return { ok: false, error: new DomainError("INVARIANT_VIOLATION", message) };
}

const EVIDENCE_FOLDER_ROLE = "04-Evidence-Reports";
const IMAGE_FOLDER_ROLE = "05-Evidence-Images";

function isImageFile(fileType: string, fileName: string): boolean {
  const type = fileType.toLowerCase();
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext);
}

function tenantIdFrom(input: { tenantId: string }): TenantId {
  return { toString: () => input.tenantId } as TenantId;
}

/**
 * Byte-backed evidence storage on the local filesystem (default / dev / Phase-1).
 * When a project workspace is available, files are written into the project's
 * workspace Evidence folder (mirroring the Drive folder tree); otherwise they
 * fall back to a flat `tenantId/evidence` layout.
 */
export class LocalEvidenceStorage implements IEvidenceStorage {
  readonly provider = "LOCAL" as const;

  constructor(
    private readonly storage: IStorage,
    private readonly workspace?: IProjectWorkspaceService,
    private readonly storageRoot: string = process.env.STORAGE_ROOT ?? "./storage",
  ) {}

  async save(input: SaveEvidenceInput): Promise<Result<EvidenceLocation, DomainError>> {
    if (!input.buffer) return fail("Local storage requires the file bytes");
    const ext = input.fileName.split(".").pop()?.toLowerCase() ?? input.fileType;

    let storageKey = `${input.tenantId}/evidence/${input.evidenceId}.${ext}`;
    if (input.projectId && this.workspace) {
      const projectId: string = input.projectId;
      const folder = await this.resolveEvidenceFolder({
        tenantId: input.tenantId,
        projectId,
        fileType: input.fileType,
        fileName: input.fileName,
      });
      if (!folder.ok) return folder;
      storageKey = folder.value.relativeKey(`${input.evidenceId}.${ext}`);
    }

    try {
      const stored = await this.storage.put({
        key: storageKey,
        body: input.buffer,
        contentType: input.fileType,
      });
      return ok({
        provider: "LOCAL",
        fileUrl: stored.url,
        fileSize: input.fileSize,
        storageKey,
      });
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Local storage write failed");
    }
  }

  private async resolveEvidenceFolder(input: {
    tenantId: string;
    projectId: string;
    fileType: string;
    fileName: string;
  }): Promise<Result<{ relativeKey: (fileName: string) => string }, DomainError>> {
    if (!this.workspace) return fail("Project workspace is not configured");
    const workspace = await this.workspace.ensureProjectWorkspace(tenantIdFrom(input), input.projectId);
    if (!workspace.ok) return workspace;
    const role = isImageFile(input.fileType, input.fileName) ? IMAGE_FOLDER_ROLE : EVIDENCE_FOLDER_ROLE;
    const folder = workspace.value.subfolders?.find((f) => f.role === role);
    if (!folder) return fail(`Project evidence folder (${role}) is not provisioned`);
    const base = resolve(this.storageRoot);
    const dir = resolve(folder.id);
    if (dir === base || !dir.startsWith(`${base}/`)) {
      return fail("Project evidence folder is outside the storage root");
    }
    const prefix = relative(base, dir).split(sep).join("/");
    return ok({ relativeKey: (fileName) => `${prefix}/${fileName}` });
  }

  async resolveDownloadUrl(location: EvidenceLocation): Promise<string> {
    return location.fileUrl;
  }

  async remove(location: EvidenceLocation): Promise<void> {
    if (location.storageKey) {
      try {
        await this.storage.remove(location.storageKey);
      } catch {
        // best-effort
      }
    }
  }

  async readBytes(location: EvidenceLocation): Promise<Buffer> {
    if (!location.storageKey) throw new Error("Local evidence has no storage key");
    const storage = this.storage as unknown as { read: (key: string) => Promise<Buffer> };
    if (typeof storage.read !== "function") {
      throw new Error("Underlying storage does not support byte reads");
    }
    return storage.read(location.storageKey);
  }
}
